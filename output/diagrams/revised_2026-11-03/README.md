# ElderCareAI revised diagrams

Six general diagrams, revised on November 3, 2026 from the current project.

| No. | Diagram | Image | Editable code |
| --- | --- | --- | --- |
| 1 | AI architecture | 01-ai-architecture.png | 01-ai-architecture.mmd |
| 2 | Program workflow | 02-program-workflow.png | 02-program-workflow.mmd |
| 3 | Admin workflow | 03-admin-workflow.png | 03-admin-workflow.mmd |
| 4 | Network design | 04-network-design.png | 04-network-design.mmd |
| 5 | Network model | 05-network-model.png | 05-network-model.mmd |
| 6 | Network topology | 06-network-topology.png | 06-network-topology.mmd |

## Main revisions

- Galaxy Watch6 replaces Fitbit Inspire 3. Health history replaces the old Google Health connection.
- Supabase supplies authentication, APIs, patient records and live updates.
- Threshold alerts follow app rules. Elle supplies recorded-data answers and Gemini-assisted explanations.
- The caregiver workflow includes location, care plans, reminders, SOS and care actions.
- The administrator workflow includes records, account management, alerts, reports and audit logs.
- Android remote notifications use Expo Push Service and Firebase Cloud Messaging.

## Scope

These are simplified conceptual diagrams. The program workflow includes Yes/No checks for login, watch readiness and continuing the session. Its three feature branches cover health/location/reports, care management/SOS, and Elle AI/settings. The branches represent options available from the dashboard, rather than tasks that must all be completed together. The admin workflow includes login authorization and whether there are more tasks. Detailed failure handling and database internals are omitted.

The network design shows the main service connections. Internet traffic uses HTTPS and live-update connections. The watch can upload through its available internet connection; it is not shown as depending entirely on the caregiver app for uploads.

The network model is client-server. Its external-service box groups AI and push providers for clarity.

The topology is a logical cloud-centered view with a local Bluetooth pairing link. It is not a physical LAN or router deployment plan. Cloud services are grouped even though Supabase, Gemini and Expo/FCM are separate providers.

Health history contains saved records, including overnight data. Its presence in these diagrams does not imply every vital is measured continuously.

`NETWORK_DIAGRAM_DESCRIPTIONS.md` contains report-style descriptions of the network design, network model and network topology.

## Editing and rendering

Each `.mmd` file contains editable Mermaid code. `ALL_DIAGRAM_CODES.md` collects all six sources in one document. `mermaid-config.json` supplies the general font, spacing and colors; `workflow-config.json` supplies the more compact spacing for the two conditional workflows. The images were rendered directly from these sources with Mermaid CLI at 2x scale.
