# MarketLink - Problem Definition and Design

## 1. Problem definition
Shoppers at local farmers markets rarely know in advance which farmers will be there, what they have in stock
or at what price. Farmers have no easy way to publish weekly stock, take pre-orders or build a relationship with
regular customers. MarketLink is a full-stack web application (MongoDB, Express, React, Node.js) that brings
farmers and customers together: farmers publish stock and manage pre-orders, customers discover markets on a map,
reserve items for pickup and leave reviews, and an administrator manages users, markets and content.

Out of scope (per the SRS): online payment (paid in person at pickup), delivery, and verification of a farmer's
identity or food-safety certification.

## 2. Architecture
```mermaid
flowchart LR
  B["Web browser<br/>React SPA (Vite)"] -->|"HTTPS + JSON, JWT"| S["Express API<br/>Node.js"]
  S -->|"Mongoose queries"| D[("MongoDB Atlas<br/>data + images")]
  B -->|"map tiles"| O["OpenStreetMap"]
```
- **Client:** React single-page app; pages load on demand; Leaflet + OpenStreetMap for maps.
- **Server:** REST API under `/api`; controllers hold the business rules, routes map URLs, middleware handles
  authentication (JWT), role checks and errors.
- **Database:** MongoDB collections described in `DATABASE_DESIGN.md`.

## 3. Roles and main flow
```mermaid
flowchart TD
  Start([Start]) --> Login[User login / register]
  Login --> Role{Role}
  Role -->|Customer| C["Browse markets and products<br/>Cart and pre-order<br/>Track, modify, cancel orders<br/>Favorites, reviews, chatbot"]
  Role -->|Farmer| F["Stall profile and pickup windows<br/>Products and weekly stock<br/>Accept, ready, complete orders<br/>Dashboard, reply to reviews"]
  Role -->|Admin| A["Approve or suspend farmers<br/>Manage users and markets<br/>Moderate content<br/>Reports, categories, announcements"]
  C --> Data[("Data processing<br/>API and database")]
  F --> Data
  A --> Data
  Data --> Out[Output and reports]
  Out --> End([End])
```

## 4. Order life cycle
```mermaid
stateDiagram-v2
  [*] --> placed: Customer places pre-order (stock reserved)
  placed --> accepted: Farmer accepts
  placed --> declined: Farmer declines (stock released)
  placed --> cancelled: Customer cancels before cut-off (stock released)
  accepted --> ready: Farmer marks ready
  accepted --> declined: Farmer declines (stock released)
  accepted --> cancelled: Customer cancels before cut-off (stock released)
  accepted --> placed: Customer modifies order (needs re-confirmation)
  ready --> completed: Pickup done, paid in person
  completed --> [*]
  declined --> [*]
  cancelled --> [*]
```
Rules enforced by the server: stock is taken atomically when an order is placed, the pickup date must be an
operating day and the slot inside a pickup window, and changes are blocked after the farmer's cut-off time.

## 5. Placing a pre-order (activity flow)
```mermaid
flowchart TD
  A[Add products to cart] --> B[Choose pickup market, date and slot]
  B --> C{Slot valid for every farmer?}
  C -->|No| B
  C -->|Yes| D[Server checks farmer approval, operating day, pickup window, cut-off]
  D --> E{Enough stock?}
  E -->|No| X[Show error, nothing reserved]
  E -->|Yes| F[Reserve stock and create one order per farmer]
  F --> G[Notify customer and farmer]
```

## 6. Data flow (level 0)
```mermaid
flowchart LR
  Cu[Customer] -->|"search, orders, reviews"| M((MarketLink))
  Fa[Farmer] -->|"stock, profile, order updates"| M
  Ad[Admin] -->|"approvals, markets, moderation"| M
  M -->|"products, order status, notifications"| Cu
  M -->|"incoming orders, insights"| Fa
  M -->|"reports, platform totals"| Ad
  M <-->|"read / write"| DB[(MongoDB)]
```

## 7. Entity relationships
```mermaid
erDiagram
  USERS ||--o{ PRODUCTS : "farmer lists"
  USERS ||--o{ ORDERS : "customer places"
  USERS ||--o{ ORDERS : "farmer receives"
  USERS }o--o{ MARKETS : "farmer sells at"
  CATEGORIES ||--o{ PRODUCTS : groups
  MARKETS ||--o{ ORDERS : "pickup at"
  ORDERS ||--|{ ORDER_ITEMS : contains
  PRODUCTS ||--o{ ORDER_ITEMS : "snapshot of"
  ORDERS ||--o{ REVIEWS : "reviewed after completion"
  USERS ||--o{ REVIEWS : writes
  USERS ||--o{ NOTIFICATIONS : receives
  USERS ||--o{ ANNOUNCEMENTS : "admin publishes"
  USERS ||--o{ REPORTS : "admin generates"
```
`ORDER_ITEMS` is an embedded array inside `orders`, not a separate collection.

## 8. Key design decisions
- **JWT authentication** with role-based route guards on both server and client.
- **Snapshots in orders** (name, unit, price) so later price edits do not change order history.
- **Optimistic stock control:** conditional atomic updates prevent overselling; failures roll back.
- **Own database name** (`MONGO_DB_NAME`) so the app never shares a database with other projects.
- **Rule-based chatbot** answers from live data (products, markets, farmers); the SRS lists AI as optional.
