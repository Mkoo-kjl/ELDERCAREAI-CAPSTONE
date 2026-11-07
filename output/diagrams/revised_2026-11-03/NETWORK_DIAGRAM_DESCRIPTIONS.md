# Network Diagram Descriptions

## Network Design

The Network Design Diagram presents the main components and communication paths of ElderCareAI. Galaxy Watch6 collects patient measurements and location updates, while caregivers use the mobile application and administrators use the web portal. The phone also imports saved Health history. Supabase provides authentication, data storage and synchronization, and connects to Gemini for Elle AI explanations and to Expo Push Service and Firebase Cloud Messaging for notifications. This arrangement supports centralized records, ongoing monitoring and the delivery of health and care updates to authorized users.

## Network Model

The Network Model Diagram shows ElderCareAI following a client-server model. The Galaxy Watch application, caregiver mobile application and administrator web portal act as clients that request services from the Supabase backend. The backend authenticates requests, applies access controls and reads or updates the central database. It also coordinates connections to Gemini and notification services. By keeping shared records and core services in the cloud, the system allows authorized users to access consistent health and care information across their devices.

## Network Topology

The Network Topology Diagram illustrates a cloud-centered arrangement in which the Galaxy Watch6, caregiver phone and administrator computer connect through the internet to the system's cloud services. A separate Bluetooth link pairs the watch with the phone and supports companion synchronization. Supabase acts as the central application backend, while AI and push services are grouped within the cloud for simplicity. This is a logical view of the system's connections, showing both internet communication and the local wearable link.
