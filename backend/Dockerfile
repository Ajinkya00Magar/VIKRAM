FROM python:3.11-slim

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y \
    gcc g++ curl libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Fix Prophet/CmdStanPy validation bug (cmdstanpy 1.3+ expects a makefile even in precompiled Prophet bundles)
RUN python -c "import os, glob, prophet; stan_model_dir = os.path.join(os.path.dirname(prophet.__file__), 'stan_model'); [open(os.path.join(d, 'makefile'), 'a').close() for d in glob.glob(os.path.join(stan_model_dir, 'cmdstan-*'))]"

# Copy application
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--log-level", "info"]
