# MarketLink - Database Design

Database: **MongoDB** (Atlas), accessed through Mongoose. The SRS allows MongoDB as the database, so the
"table definitions" are the collections below. They are created by the models in `backend/models/`
and can be (re)created with `npm run db:init` (see the README). Sample documents are in
`database/sample-data/`.

Every document also has `_id` (ObjectId, primary key) and, unless noted, `createdAt` / `updatedAt`.
An ObjectId reference (FK) is written as `ref -> collection`.

## users
One collection for all three roles. Role-specific data lives in `farmerProfile` (farmers only).

| Attribute | Type | Key / Rule |
|---|---|---|
| name | String(100) | required |
| email | String | UNIQUE, lower-cased |
| password | String | bcrypt hash, never returned by the API |
| phone | String | required |
| address | String | required |
| role | String | `customer` \| `farmer` \| `admin` |
| isActive | Boolean | admin can deactivate |
| farmerProfile.stallName / contactPerson | String | farmers only |
| farmerProfile.description | String(1000) | |
| farmerProfile.approvalStatus | String | `pending` \| `approved` \| `suspended` |
| farmerProfile.markets | [ObjectId] | ref -> markets |
| farmerProfile.operatingDays | [String] | monday..sunday |
| farmerProfile.pickupWindows | [{day, start, end}] | times as HH:mm |
| farmerProfile.cutoffHours | Number | orders editable until this many hours before pickup |
| farmerProfile.location | {address, mapPin, latitude, longitude} | for the map |
| farmerProfile.geo | GeoJSON Point | 2dsphere index, used for "near me" |
| farmerProfile.ratingAvg / ratingCount | Number | recalculated when reviews change |
| favorites.farmers / products / markets | [ObjectId] | ref -> users / products / markets |

Indexes: `email` (unique), `farmerProfile.geo` (2dsphere), `role + farmerProfile.approvalStatus`.

## markets
| Attribute | Type | Key / Rule |
|---|---|---|
| name | String(100) | required |
| address | String | required |
| latitude / longitude | Number | required, -90..90 / -180..180 |
| geo | GeoJSON Point | derived from latitude/longitude, 2dsphere index |
| mapProvider | String | `google` \| `openstreetmap` |
| mapLink | String | optional embedded/share link |
| operatingDays | [String] | |
| openTime / closeTime | String | HH:mm |
| isActive | Boolean | |

## categories
| Attribute | Type | Key / Rule |
|---|---|---|
| name | String(50) | UNIQUE |
| description | String | |
| isActive | Boolean | inactive categories are hidden from customers |

## products
| Attribute | Type | Key / Rule |
|---|---|---|
| farmer | ObjectId | FK -> users (farmer), indexed |
| category | ObjectId | FK -> categories, indexed |
| name | String(100) | text index |
| description | String(1000) | text index |
| price | Number | >= 0 |
| unit | String | kg, dozen, bunch... |
| quantityAvailable | Number | >= 0; changed atomically when orders are placed/cancelled |
| image | String | URL such as `/uploads/abc.png`; the file itself is stored in the `images` collection |
| available | Boolean | farmer's "temporarily unavailable" switch |
| weeklyTemplate | {enabled, quantity} | recurring weekly stock |
| isActive | Boolean | |
| ratingAvg / ratingCount | Number | recalculated from reviews |

Derived status: `unavailable` (available = false), `sold_out` (quantity 0) or `available`.

## orders
An order belongs to exactly one farmer; a cart with several farmers becomes several orders.

| Attribute | Type | Key / Rule |
|---|---|---|
| customer | ObjectId | FK -> users, indexed |
| farmer | ObjectId | FK -> users, indexed |
| market | ObjectId | FK -> markets (pickup market) |
| items | [{product, name, unit, price, quantity}] | name/unit/price are a snapshot at order time |
| totalAmount | Number | sum of items; paid in person at pickup |
| pickupDate | String | YYYY-MM-DD |
| pickupSlot | {start, end} | HH:mm |
| notes | String(500) | |
| status | String | `placed` \| `accepted` \| `declined` \| `ready` \| `completed` \| `cancelled` |
| statusHistory | [{status, at}] | audit trail |

## reviews
| Attribute | Type | Key / Rule |
|---|---|---|
| customer | ObjectId | FK -> users |
| order | ObjectId | FK -> orders (must be `completed`) |
| farmer | ObjectId | FK -> users |
| product | ObjectId | FK -> products (absent for a farmer review) |
| targetType | String | `farmer` \| `product` |
| rating | Number | 1..5 |
| comment | String(1000) | |
| reply | {text, at} | farmer's response |

Unique index: `customer + order + targetType + product` (one review per target per order).

## notifications
| Attribute | Type | Key / Rule |
|---|---|---|
| user | ObjectId | FK -> users, indexed |
| type | String | `order` \| `restock` \| `announcement` \| `account` \| `review` |
| title / message / link | String | |
| read | Boolean | |

## announcements
| Attribute | Type | Key / Rule |
|---|---|---|
| title / message | String | |
| audience | String | `all` \| `farmers` \| `customers` |
| createdBy | ObjectId | FK -> users (admin) |

## reports
| Attribute | Type | Key / Rule |
|---|---|---|
| generatedBy | ObjectId | FK -> users (admin) |
| reportType | String | `summary` \| `revenue_by_market` \| `active_farmers` |
| data | Mixed | snapshot of the report |
| generatedAt | Date | |

## Differences from the SRS example tables
The SRS says the example tables may be changed to suit the design. Main differences:
- Farmers and customers share the `users` collection (with `role`); `username` is replaced by `name` + `email`.
- An order holds several items (`items[]`) instead of one product per row, so `quantity` and `product_id` live inside each item.
- `products.stock_quantity` is `quantityAvailable`; extra fields support weekly templates, images and availability.
- Reviews can target a farmer or a product and can carry a farmer reply.
