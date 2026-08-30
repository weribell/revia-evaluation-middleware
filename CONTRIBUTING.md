# Contributing

Thank you for considering a contribution to Revia.

## Before opening a change

1. Open an issue or describe the problem and expected behavior.
2. Keep changes focused and avoid committing generated build output.
3. Do not add scraped website content, participant records, secrets, private prompts, or proprietary documents.
4. Use fictional or clearly licensed fixtures in tests.

## Development checks

Backend:

```bash
python3 -B -m unittest discover -s prototype/tests -p 'test_*.py'
python3 -B -m unittest discover -s tests -p 'test_*.py'
```

Frontend:

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm check:localization
pnpm check:licenses
pnpm build
```

## Contributions and licensing

Unless explicitly stated otherwise, an intentionally submitted contribution is provided under the Apache License 2.0, in accordance with section 5 of that license. Contributors must have the right to submit their code and fixtures. Do not submit employer-owned, confidential, or third-party material without permission.

Small research projects normally do not need a separate Contributor License Agreement. If institutional ownership or substantial external contributions become relevant, the project maintainers should review this decision before accepting them.
