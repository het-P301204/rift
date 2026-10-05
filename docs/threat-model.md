# RIFT Threat Model

## Controlled Research Environment

RIFT is designed as a closed research environment. All attack demonstrations target intentionally configured local simulation components. The threat model below documents the risks RIFT is designed to prevent and the architectural decisions that enforce those boundaries.

---

## Threat: Malicious Scenario Configuration

**Description:** A modified scenario YAML could attempt to direct traffic outside the lab.

**Mitigation:** Stream builders are hardcoded Python functions, not derived from YAML configuration. YAML files contain educational metadata (descriptions, expected outcomes, mitigations). No YAML field is ever executed or used as a network target.

---

## Threat: Arbitrary Target URLs

**Description:** A user-supplied "target URL" could be used to attack production infrastructure.

**Mitigation:** RIFT has no target URL field. All stream destinations are hardcoded to `lab.rift` or `localhost`. The UI exposes only internal simulation identifiers, not URL inputs. Network requests from the scenario engine go nowhere — they are parsed as byte arrays in memory.

---

## Threat: Accidental External Requests

**Description:** The protocol engine or simulation layer could make unintended outbound connections.

**Mitigation:** The simulation layer does not use Python's `socket`, `http.client`, `requests`, or `httpx`. It constructs byte arrays and passes them to the protocol parser. No network connections are opened during scenario execution. The test suite verifies that no stream builder contains external URLs.

---

## Threat: Resource Exhaustion

**Description:** Malformed scenario configurations or large payloads could exhaust memory or CPU.

**Mitigation:** Stream builders produce fixed-size byte sequences. The protocol parser operates on bounded input. SQLite writes are bounded per run. No streaming large files or unbounded loops.

---

## Threat: Container Breakout

**Description:** Not applicable — RIFT does not use Docker containers in the current implementation.

**Note:** When Docker support is added in a future version, containers will run without privileged mode, with explicit port exposure, CPU/memory limits, and separate bridge networks.

---

## Threat: Malicious Request Payloads in the UI

**Description:** A user could paste malicious content into the request editor that gets executed.

**Mitigation:** The request editor sends content to the API, which treats it as a byte array for analysis. No user-supplied content is ever eval'd, executed as a shell command, or used as a URL target.

---

## Threat: Unsafe Command Construction

**Description:** User-supplied scenario parameters could be used in shell commands.

**Mitigation:** RIFT uses no subprocess calls or shell commands derived from user input. All operations are Python in-process.

---

## Threat: Sensitive Data Leakage

**Description:** Real victim credentials could appear in run records.

**Mitigation:** All victim credentials in synthetic streams are clearly prefixed with `DEMO_`:
- `session=DEMO_VICTIM_SESSION_8F31`
- `Authorization: Bearer DEMO_VICTIM_TOKEN`

The test suite asserts that all stream builders use `DEMO_` prefixes. The UI labels any credential display with "SYNTHETIC CREDENTIAL — LAB ONLY".

---

## Threat: Poisoned Dependencies

**Description:** A compromised dependency could introduce malicious behavior.

**Mitigation:** Dependencies are pinned in `requirements.txt` and `package.json`. The dependency set is minimal: FastAPI, SQLAlchemy, PyYAML, and standard library. Audit with `pip audit` and `npm audit` before production use.

---

## Lab Fail-Closed Behavior

RIFT is designed to fail closed. If a scenario configuration is invalid, unrecognized, or missing a stream builder, the API returns an error event rather than attempting to execute against an unknown target. Unknown proxy or backend names produce an immediate ERROR event and halt the run.

---

## What RIFT Is Not

RIFT is not:
- A production vulnerability scanner
- A tool for testing infrastructure you do not own
- A WAF bypass generator for arbitrary targets
- A real-credential-capture framework

Every RIFT result is a research observation produced inside a controlled local environment. The impact visualizations use clearly labeled synthetic data. The WAF is a simulated local rule engine.
