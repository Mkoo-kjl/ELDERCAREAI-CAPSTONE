# ElderCareAI - Six Revised Diagram Codes

Editable Mermaid sources. Use workflow-config.json for the program/admin workflows and mermaid-config.json for the other diagrams.

## AI Architecture

```mermaid
---
title: ElderCareAI - AI Architecture
---
flowchart TD
    A["Data sources<br/>Galaxy Watch6, Health history<br/>and care records"] --> B[("Supabase data<br/>Validated patient records")]
    B --> C["Health analysis<br/>Trends and threshold rules"]
    B --> D["Elle AI<br/>Recorded-data answers<br/>and Gemini explanations"]
    C --> E["Caregiver app<br/>Dashboard, reports and alerts"]
    D --> E

    classDef standard fill:#EBF7F8,stroke:#397F88,color:#202D2B,stroke-width:1.5px;
    classDef data fill:#EFF7E9,stroke:#3C704A,color:#202D2B,stroke-width:1.5px;
    class A,C,D,E standard;
    class B data;
```

## Program Workflow

```mermaid
---
title: ElderCareAI - Program Workflow
---
flowchart TD
    S(["Start"]) --> A["Sign in"]
    A --> L{"Login<br/>successful?"}
    L -->|No| A
    L -->|Yes| B["Complete caregiver and patient profiles<br/>Pair Galaxy Watch6 and allow access"]
    B --> W{"Watch<br/>ready?"}
    W -->|No| R["Check pairing, connection<br/>and permissions"]
    R --> W
    W -->|Yes| C["Start monitoring and open dashboard<br/>Sync watch updates and Health history"]
    C --> H["Health and location<br/>Vitals, trends, GPS and alerts<br/>Export health and care reports"]
    C --> K["Care management<br/>Medications, appointments and notes<br/>Reminders, Taken and SOS"]
    C --> I["Elle AI and settings<br/>Ask questions and view insights<br/>Manage profiles and notifications"]
    H --> E{"Continue<br/>session?"}
    K --> E
    I --> E
    E -->|Yes| C
    E -->|No| X["Finish monitoring and sign out"]
    X --> F(["End session"])

    classDef standard fill:#EBF7F8,stroke:#397F88,color:#202D2B,stroke-width:1.5px;
    classDef terminal fill:#397F88,stroke:#397F88,color:#FFFFFF,stroke-width:1.5px;
    classDef decision fill:#EFF7E9,stroke:#3C704A,color:#202D2B,stroke-width:1.5px;
    class A,B,C,H,K,I,R,X standard;
    class L,W,E decision;
    class S,F terminal;
```

## Admin Workflow

```mermaid
---
title: ElderCareAI - Admin Workflow
---
flowchart TD
    S(["Start"]) --> A["Sign in as administrator"]
    A --> L{"Access<br/>allowed?"}
    L -->|No| A
    L -->|Yes| B["Open admin dashboard"]
    B --> C["Review records or manage accounts<br/>Caregivers and older adults"]
    C --> D["Review health data and alerts<br/>Export reports or check audit logs"]
    D --> M{"More<br/>tasks?"}
    M -->|Yes| B
    M -->|No| E["Sign out"]
    E --> F(["End"])

    classDef standard fill:#EBF7F8,stroke:#397F88,color:#202D2B,stroke-width:1.5px;
    classDef terminal fill:#397F88,stroke:#397F88,color:#FFFFFF,stroke-width:1.5px;
    classDef decision fill:#EFF7E9,stroke:#3C704A,color:#202D2B,stroke-width:1.5px;
    class A,B,C,D,E standard;
    class L,M decision;
    class S,F terminal;
```

## Network Design

```mermaid
---
title: ElderCareAI - Network Design
---
flowchart TD
    W["Galaxy Watch6<br/>Watch app"] --> B["Supabase cloud<br/>Auth, API and database"]
    P["Caregiver phone<br/>App and Health history"] <-->|App data| B
    A["Admin computer<br/>Web portal"] <--> B
    B <--> G["Gemini AI"]
    B --> N["Expo Push / Firebase FCM"]
    N -->|Push| P

    classDef standard fill:#EBF7F8,stroke:#397F88,color:#202D2B,stroke-width:1.5px;
    classDef cloud fill:#EFF7E9,stroke:#3C704A,color:#202D2B,stroke-width:1.5px;
    class W,P,A,G,N standard;
    class B cloud;
```

## Network Model

```mermaid
---
title: ElderCareAI - Network Model
---
flowchart LR
    C["Clients<br/>Watch, phone and admin"] <--> S["Server: Supabase<br/>Authentication and API"]
    S <--> D[("Supabase database<br/>Health and care records")]
    S <--> X["External services<br/>Gemini and Expo / FCM"]

    classDef standard fill:#EBF7F8,stroke:#397F88,color:#202D2B,stroke-width:1.5px;
    classDef data fill:#EFF7E9,stroke:#3C704A,color:#202D2B,stroke-width:1.5px;
    class C,S,X standard;
    class D data;
```

## Network Topology

```mermaid
---
title: ElderCareAI - Network Topology
---
flowchart TD
    W["Galaxy Watch6"] ---|Internet| C["Cloud platform<br/>Supabase, AI and push services"]
    C ---|Internet| P["Caregiver phone"]
    C ---|Internet| A["Admin computer"]
    W ---|Bluetooth pairing| P

    classDef standard fill:#EBF7F8,stroke:#397F88,color:#202D2B,stroke-width:1.5px;
    classDef cloud fill:#EFF7E9,stroke:#3C704A,color:#202D2B,stroke-width:1.5px;
    class W,P,A standard;
    class C cloud;
    linkStyle 3 stroke:#65736E,stroke-dasharray:5 4;
```

## mermaid-config.json

```json
{
  "theme": "base",
  "htmlLabels": true,
  "themeVariables": {
    "fontFamily": "Segoe UI, Arial, sans-serif",
    "fontSize": "20px",
    "primaryColor": "#EBF7F8",
    "primaryTextColor": "#202D2B",
    "primaryBorderColor": "#397F88",
    "lineColor": "#65736E",
    "secondaryColor": "#EFF7E9",
    "tertiaryColor": "#F8FAF9",
    "edgeLabelBackground": "#FFFFFF",
    "titleColor": "#202D2B"
  },
  "flowchart": {
    "htmlLabels": true,
    "curve": "linear",
    "nodeSpacing": 46,
    "rankSpacing": 60,
    "padding": 20,
    "wrappingWidth": 400,
    "useMaxWidth": false
  },
  "themeCSS": ".flowchartTitleText { font-size: 27px !important; font-weight: 600 !important; }"
}
```

## workflow-config.json

```json
{
  "theme": "base",
  "htmlLabels": true,
  "themeVariables": {
    "fontFamily": "Segoe UI, Arial, sans-serif",
    "fontSize": "20px",
    "primaryColor": "#EBF7F8",
    "primaryTextColor": "#202D2B",
    "primaryBorderColor": "#397F88",
    "lineColor": "#65736E",
    "secondaryColor": "#EFF7E9",
    "tertiaryColor": "#F8FAF9",
    "edgeLabelBackground": "#FFFFFF",
    "titleColor": "#202D2B"
  },
  "flowchart": {
    "htmlLabels": true,
    "curve": "linear",
    "nodeSpacing": 36,
    "rankSpacing": 28,
    "padding": 10,
    "wrappingWidth": 400,
    "useMaxWidth": false,
    "minNodeWidth": 0
  },
  "themeCSS": ".flowchartTitleText { font-size: 27px !important; font-weight: 600 !important; }"
}
```
