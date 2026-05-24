# Security

## Reporting a Vulnerability

**Do not open a public issue.**

To report a security vulnerability in `leonardoai-mcp`, email:

**security@bespokeaistudios.online**

Include:
- A description of the issue
- Steps to reproduce
- Affected version(s)
- Any suggested mitigations

We aim to acknowledge reports within 48 hours and provide a fix timeline within 5 business days.

## Scope

This repository is a **stdio-only MCP server** — it does not listen on network ports. Security concerns primarily involve:

- **API key handling** — keys are read from environment variables only, never hardcoded or committed.
- **File system writes** — the `download_image` and `download_generation_images` tools write to disk. Path traversal is blocked and file sizes are capped at 50 MB.
- **Error message hygiene** — Leonardo API error responses are logged to stderr only and never exposed in tool return values or error messages visible to MCP clients.

## Supported Versions

| Version | Security Updates |
|---------|-----------------|
| 0.1.x   | ✅ Until 0.2.x releases |
