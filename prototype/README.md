# Revia Backend

Dependency-free Python HTTP API, evaluation pipeline, persistence layer, and local data loading.

Run the API from the repository root with the included synthetic dataset:

```bash
python3 -B -m prototype.api_server \
  --data-dir examples/synthetic-demo \
  --database-path .local/evaluation_runs.sqlite3 \
  --port 8765
```

The deterministic offline workflow requires no API key. See the repository-level README and `docs/` for the full setup, external evaluation contract, and data-source boundaries.
