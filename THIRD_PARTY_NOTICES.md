# Third-Party Notices

This file records licensing boundaries; it does not replace the license texts shipped with installed dependencies.

## JavaScript dependencies

The frontend uses packages declared in `frontend/package.json` and resolved in `frontend/pnpm-lock.yaml`. The final direct and transitive inventory was generated from a frozen lockfile installation on 2026-08-07 and found 462 unique package/version pairs with no missing license declaration:

- MIT: 389;
- ISC: 29;
- Apache-2.0: 18;
- BSD-2-Clause: 10;
- BSD-3-Clause: 8;
- BlueOak-1.0.0: 2;
- MPL-2.0: 2;
- `(MIT OR CC0-1.0)`, 0BSD, CC-BY-4.0, and Python-2.0: one each.

Each package remains under its own license. This summary is not a substitute for the dependency license files. Run `pnpm check:licenses -- --details` to inspect the package-by-package inventory.

Installed dependencies are not copied into this repository. `frontend/node_modules/` and compiled output are excluded.

## Python standard library

The backend is implemented with the Python standard library and does not vendor third-party Python packages.

## OpenAI service

OpenAI integration is optional and requires a user-supplied API key. Use of the external service is governed by the terms selected by that user; the Apache License 2.0 for this source repository does not grant service access or rights to model outputs.

## Project visual assets

The Revia wordmark and local interface assets are original work created by the project author and are included in this repository under the Apache License 2.0 unless a file states otherwise.
