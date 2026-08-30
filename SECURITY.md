# Security Policy

## Supported versions

This repository contains research software rather than a supported production service. Security fixes are applied to the latest main branch when feasible.

## Reporting a vulnerability

Do not include API keys, participant data, private service URLs, or exploit details in a public issue. Use GitHub Private Vulnerability Reporting for security-sensitive reports when it is enabled for the repository.

## Deployment warning

The local API does not implement production authentication or authorization. Do not expose it directly to the public internet. A deployment must add access control, TLS, request limits, secret management, backups, and a data-retention policy at the infrastructure layer.
