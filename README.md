# Revia — Review and Evaluation Infrastructure for AI Answers

Revia is open-source research software for evaluating source-grounded answers in public-administration settings. It connects citizen questions, retrieved evidence, generated answers, automated evaluation, multiple human reviews, disagreement signals, and role-specific dashboard views in one traceable workflow.

This repository is the code-only open-source distribution. It contains a small, entirely fictional dataset for demonstration and tests. It does **not** contain scraped website content, participant data, private research material, API keys, or deployment credentials.

## What is included

- a dependency-free Python HTTP API with SQLite persistence;
- a React and TypeScript frontend;
- deterministic offline answer and judge baselines;
- optional OpenAI-based answer generation and LLM-as-a-Judge;
- human-review, adjudication, research, management, and audit views;
- a fictional demo dataset under `examples/synthetic-demo/`;
- backend and frontend tests.

## Requirements

- Python 3.11 or newer recommended (Python 3.10 minimum);
- Node.js `^20.19.0` or `>=22.12.0`;
- pnpm 10.

No third-party Python package is required by the backend.

## Quick start with synthetic data

Start the API from the repository root:

```bash
python3 -B -m prototype.api_server \
  --data-dir examples/synthetic-demo \
  --database-path .local/evaluation_runs.sqlite3 \
  --port 8765
```

In a second terminal, install and start the frontend:

```bash
cd frontend
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173`.

The demo works without an API key. Offline mode uses deterministic answer generation and rule-based evaluation so the workflow can be inspected without sending data to an external service.

## Optional OpenAI integration

The backend reads OpenAI credentials from the **repository-root `.env` file**. This is different
from `frontend/.env`, which contains only the public API base URL. Never put an API key in
`frontend/.env`, because frontend environment values can be exposed to the browser bundle.

From the repository root, create the private backend environment file:

```bash
cp .env.example .env
```

Open the newly created root `.env` and set:

```dotenv
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5-mini
```

Save the file and restart the Python backend. The backend loads this file automatically when it is
started from the repository root. The Developer Lab's `Prompt & Judge` area will then offer the
OpenAI workflow; without the key, Revia remains in deterministic offline mode.

Never commit the resulting `.env` file or paste the key into the frontend. When a key is configured,
prompts and source context sent through the OpenAI workflow leave the local machine; do not use
participant data or restricted documents without an appropriate data-protection basis.

## Tests

Run the backend tests from the repository root:

```bash
python3 -B -m unittest discover -s prototype/tests -p 'test_*.py'
python3 -B -m unittest discover -s tests -p 'test_*.py'
```

Run the frontend checks:

```bash
cd frontend
pnpm test
pnpm lint
pnpm check:localization
pnpm check:licenses
pnpm build
```

## Using other datasets

The default prompts use source-neutral public-administration language. The API accepts JSONL service and question records and can also evaluate externally supplied question, answer, and source-context records. See [docs/data-format.md](docs/data-format.md).

## Research status and limitations

Revia is working research software, not yet a production-ready or officially supported public-service system. Generated answers and scores are experimental outputs and must not be treated as authoritative administrative or legal advice. Authentication, authorization, production hardening, long-term migrations, and operational monitoring remain outside the current release scope.

The synthetic human reviews included in the demo are interface fixtures. They are not empirical annotations and must not be reported as study results.

## Repository scope

The Apache License 2.0 in this repository covers the source code and the synthetic test/demo fixtures created for this project. It does not license third-party website content, externally obtained datasets, trademarks, participant data, or material downloaded by users after installation.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for dependency and external-source notes.

## Contributing and citation

See [CONTRIBUTING.md](CONTRIBUTING.md) before proposing changes and [SECURITY.md](SECURITY.md) for responsible disclosure. Citation metadata is provided in [CITATION.cff](CITATION.cff); release metadata can be updated when the first public version is tagged.

## License

Apache License 2.0. See [LICENSE](LICENSE).
