# Data Format

The local demo directory contains newline-delimited JSON (JSONL): one JSON object per line.

## Services

`services.jsonl` contains source documents available to the evaluation pipeline. A minimal record is:

```json
{
  "service_id": "fictional_service_001",
  "title": "Community garden permit",
  "url": "https://example.invalid/services/community-garden",
  "description": "A fictional service used only for demonstration.",
  "full_text": "Combined fictional source text.",
  "sections": {
    "requirements": "Fictional eligibility requirements.",
    "required_documents": "Fictional required documents.",
    "fees": "Fictional fee information."
  }
}
```

Common section keys are `requirements`, `required_documents`, `fees`, `processing_time`, `responsibility_notes`, `forms`, `online_abwicklung`, and `additional_information`.

## Citizen questions

`citizen_questions.jsonl` links a question to a service and target section. Required operational fields include `question_id`, `service_id`, `service_title`, `source_url`, `question_text`, and `target_section`. The additional style, intent, difficulty, and expected-behavior fields support controlled evaluation analysis.

## Evaluation traces

`sample_evaluation_traces.jsonl` stores the shared evaluation record: question, service reference, retrieved evidence, generated answer, automated evaluation, optional human reviews, and disagreement signal. It is intentionally more detailed than a simple benchmark row because traceability is the middleware's core artifact.

## External evaluations

An external system can submit its own question, answer, and source context to `POST /api/v1/evaluations`. Inspect `GET /api/v1/integration/status` for the current contract and supported endpoints.

## Sensitive data

Do not commit runtime SQLite files, reviewer assignments, participant profiles, free-text human comments, or raw imported datasets. Use a local ignored directory and establish a retention and anonymization policy before empirical data collection.

