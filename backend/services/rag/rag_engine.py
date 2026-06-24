"""
PS13 — Offline RAG Engine
ChromaDB + BGE-Small embeddings for knowledge retrieval.
Sources: runbooks, incident history, topology docs, fault reports.
100% offline — no external API calls.
"""
import os
from typing import List, Dict, Any, Optional
from pathlib import Path
import structlog
import chromadb
from chromadb.config import Settings as ChromaSettings

logger = structlog.get_logger(__name__)

RUNBOOK_DIR = Path("/app/data/runbooks")
COLLECTION_NAME = os.environ.get("CHROMA_COLLECTION", "ps13_knowledge")


class RAGEngine:
    """
    Offline Retrieval-Augmented Generation engine.
    Indexes all operational documents into ChromaDB
    and retrieves context for copilot queries.
    """

    def __init__(self):
        self._client: Optional[chromadb.HttpClient] = None
        self._collection = None
        self._embedder = None
        self._initialized = False

    def initialize(self):
        """Connect to ChromaDB and load embedding model."""
        if self._initialized:
            return

        # Connect to ChromaDB
        chroma_host = os.environ.get("CHROMA_HOST", "chromadb")
        chroma_port = int(os.environ.get("CHROMA_PORT", 8000))

        try:
            self._client = chromadb.HttpClient(
                host=chroma_host,
                port=chroma_port,
                settings=ChromaSettings(anonymized_telemetry=False),
            )
            self._client.heartbeat()
            logger.info("ChromaDB connected", host=chroma_host)
        except Exception as e:
            logger.error("ChromaDB connection failed", error=str(e))
            # Fallback to in-memory
            self._client = chromadb.Client()

        # Get or create collection
        self._collection = self._client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )

        # Load embedding model (offline)
        self._load_embedder()
        self._initialized = True
        logger.info("RAG engine initialized", collection=COLLECTION_NAME)

    def _load_embedder(self):
        """Load BGE-Small embedding model (offline)."""
        try:
            from sentence_transformers import SentenceTransformer
            model_name = os.environ.get("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")
            device = os.environ.get("EMBEDDING_DEVICE", "cpu")
            self._embedder = SentenceTransformer(model_name, device=device)
            logger.info("Embedding model loaded", model=model_name)
        except Exception as e:
            logger.error("Embedding model load failed", error=str(e))
            self._embedder = None

    def embed(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for a list of texts."""
        if self._embedder is None:
            # Fallback: simple TF-IDF-like hash embeddings (not for production)
            return [[hash(t) % 1000 / 1000.0] * 384 for t in texts]
        # BGE-Small requires query prefix for asymmetric retrieval
        return self._embedder.encode(texts, normalize_embeddings=True).tolist()

    def index_document(self, doc_id: str, content: str,
                       metadata: Dict[str, Any] = None):
        """Index a single document into ChromaDB."""
        if not self._initialized:
            self.initialize()
        try:
            # Chunk document if too long
            chunks = self._chunk_text(content, chunk_size=512, overlap=64)
            ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
            embeddings = self.embed(chunks)
            metadatas = [{**(metadata or {}), "source": doc_id, "chunk": i}
                         for i in range(len(chunks))]
            self._collection.upsert(
                ids=ids,
                documents=chunks,
                embeddings=embeddings,
                metadatas=metadatas,
            )
            logger.info("Document indexed", doc_id=doc_id, chunks=len(chunks))
        except Exception as e:
            logger.error("Document indexing failed", doc_id=doc_id, error=str(e))

    def index_all_runbooks(self):
        """Index all runbooks from the data/runbooks directory."""
        if not RUNBOOK_DIR.exists():
            logger.warning("Runbook directory not found", path=str(RUNBOOK_DIR))
            return

        count = 0
        for filepath in RUNBOOK_DIR.glob("**/*.md"):
            content = filepath.read_text(encoding="utf-8")
            doc_id = filepath.stem
            self.index_document(
                doc_id=doc_id,
                content=content,
                metadata={"type": "runbook", "filename": filepath.name},
            )
            count += 1

        for filepath in RUNBOOK_DIR.glob("**/*.txt"):
            content = filepath.read_text(encoding="utf-8")
            self.index_document(
                doc_id=filepath.stem,
                content=content,
                metadata={"type": "runbook", "filename": filepath.name},
            )
            count += 1

        logger.info("Runbooks indexed", count=count)

    def index_incident(self, incident_id: str, description: str,
                       root_cause: str, resolution: str, tags: List[str] = None):
        """Index a historical incident for RAG retrieval."""
        content = f"""INCIDENT: {incident_id}
DESCRIPTION: {description}
ROOT CAUSE: {root_cause}
RESOLUTION: {resolution}
TAGS: {', '.join(tags or [])}"""
        self.index_document(
            doc_id=f"incident_{incident_id}",
            content=content,
            metadata={"type": "incident", "tags": ",".join(tags or [])},
        )

    def retrieve(self, query: str, top_k: int = 5,
                 filter_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Retrieve most relevant documents for a query.
        Returns list of {content, source, score, metadata}.
        """
        if not self._initialized:
            self.initialize()

        try:
            # BGE-Small requires query prefix
            query_with_prefix = f"Represent this sentence for searching relevant passages: {query}"
            query_embedding = self.embed([query_with_prefix])[0]

            where = {"type": filter_type} if filter_type else None

            results = self._collection.query(
                query_embeddings=[query_embedding],
                n_results=min(top_k, max(self._collection.count(), 1)),
                where=where,
                include=["documents", "metadatas", "distances"],
            )

            docs = []
            for doc, meta, dist in zip(
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0],
            ):
                score = 1.0 - dist  # cosine: 0=identical, 2=opposite
                docs.append({
                    "content": doc,
                    "source": meta.get("source", "unknown"),
                    "type": meta.get("type", "unknown"),
                    "score": round(score, 4),
                    "metadata": meta,
                })

            # Filter by score threshold
            threshold = float(os.environ.get("RAG_SCORE_THRESHOLD", "0.65"))
            docs = [d for d in docs if d["score"] >= threshold]
            logger.debug("RAG retrieved", query=query[:50], count=len(docs))
            return docs

        except Exception as e:
            logger.error("RAG retrieval failed", error=str(e))
            return []

    def build_context(self, query: str, top_k: int = 5) -> str:
        """Build a formatted context string for the copilot prompt."""
        docs = self.retrieve(query, top_k=top_k)
        if not docs:
            return "No relevant runbooks or incident history found."

        context_parts = []
        for i, doc in enumerate(docs, start=1):
            context_parts.append(
                f"[Source {i}: {doc['source']} (relevance: {doc['score']:.2f})]\n{doc['content']}"
            )
        return "\n\n---\n\n".join(context_parts)

    def get_stats(self) -> Dict[str, Any]:
        """Return collection statistics."""
        if not self._initialized:
            return {"status": "not_initialized"}
        try:
            count = self._collection.count()
            return {"status": "ready", "document_chunks": count, "collection": COLLECTION_NAME}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    @staticmethod
    def _chunk_text(text: str, chunk_size: int = 512, overlap: int = 64) -> List[str]:
        """Split text into overlapping chunks."""
        words = text.split()
        if len(words) <= chunk_size:
            return [text]
        chunks = []
        start = 0
        while start < len(words):
            end = min(start + chunk_size, len(words))
            chunks.append(" ".join(words[start:end]))
            start += chunk_size - overlap
        return chunks


# Singleton
_rag: Optional[RAGEngine] = None


def get_rag() -> RAGEngine:
    global _rag
    if _rag is None:
        _rag = RAGEngine()
    return _rag
