# ElderCareAI Updated Database Diagrams

Verified schema date: 7 November 2026. Both diagrams use the dictionary’s 18 core tables.

- Database design: all 245 fields and 34 declared foreign keys within the core model. Five external references to Supabase Auth are marked on the fields without adding another application table.
- Chen ERD: rectangles for entities, ovals for selected attributes, underlined primary keys and 19 named relationship diamonds. Cardinality labels show maximum 1 or N. Optionality and all supporting ownership links are available in the database design.
- A patient can have historical watch registrations but only one active registration. A patient has at most one safe-zone configuration and one live-state row.
- Safe-zone event configuration names and revisions are snapshots, not declared foreign keys. AI evidence record IDs are JSON references, not relational FK columns.

Edit the database source by importing the DBML into dbdiagram.io. Edit the Chen source by opening its DRAWIO file in diagrams.net. SVG files remain sharp when zoomed or placed into a manuscript; PNG files are provided for direct insertion.
