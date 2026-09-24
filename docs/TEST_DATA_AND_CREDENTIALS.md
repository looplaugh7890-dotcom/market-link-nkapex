# MarketLink - Test Data and User Credentials

## Loading the test data
From the `backend/` folder run `npm run seed`. This wipes the app's collections in the configured database
and recreates the data below. It refuses to run against the shared default `test` database.

## User credentials (all passwords: `Password@123`)
| Role | E-mail | Notes |
|---|---|---|
| Admin | admin@marketlink.test | Full admin panel |
| Farmer (approved) | farmer@marketlink.test | Fred's Fresh Produce; can list products and take orders |
| Farmer (pending) | pending.farmer@marketlink.test | Pending Patch; waiting for admin approval, so products/orders are locked |
| Customer | customer@marketlink.test | Cathy Customer |

## Seeded data
- **Categories:** Vegetables, Fruits, Dairy, Baked Goods, Eggs & Poultry.
- **Market:** Green Valley Market, 12 Orchard Road, open Saturday and Sunday 08:00-14:00.
- **Fred's Fresh Produce:** sells at Green Valley Market; operating days Saturday and Sunday; pickup windows
  Saturday and Sunday 09:00-13:00; order cut-off 12 hours before pickup.
- **Products:** Tomatoes (3.50/kg, 50, weekly template 50), Carrots (2.00/kg, 30), Apples (4.25/kg, 40),
  Free-range Eggs (5.00/dozen, 20).

## Suggested test cases
| # | Area | Steps | Expected result |
|---|---|---|---|
| 1 | Registration | Register a customer with an existing e-mail | Error: duplicate e-mail |
| 2 | Registration | Register a new farmer | Account created as pending; banner explains approval is needed |
| 3 | Login | Wrong password | "Invalid credentials" |
| 4 | Access control | Log in as customer and open `/admin` | Redirected to the customer area |
| 5 | Markets | Open Markets, filter Day = Monday | No markets; Saturday shows Green Valley Market |
| 6 | Map | Open a market | Map with marker; both directions links open |
| 7 | Products | Filter Vegetables, price 2 to 4, market Green Valley | Tomatoes and Carrots |
| 8 | Cart | Add Tomatoes x2 as customer | Cart badge shows 2 |
| 9 | Pre-order | Checkout for the next Saturday, a 09:00-13:00 slot | Order placed; stock of Tomatoes drops by 2 |
| 10 | Pre-order | Pick a Monday | No pickup slots offered |
| 11 | Stock | Order more than the stock | Error: not enough stock; nothing reserved |
| 12 | Cancel | Cancel the order before cut-off | Status cancelled; stock restored |
| 13 | Farmer orders | Farmer accepts, marks ready, completes | Customer gets a notification at each step |
| 14 | Reviews | Customer rates farmer and product on the completed order | Ratings shown on product and stall pages |
| 15 | Reviews | Farmer replies to the review | Reply shown under the review |
| 16 | Favorites | Heart a product; farmer sets it sold out then restocks | Customer gets a "back in stock" alert |
| 17 | Chatbot | Ask "Do you have apples?" | Lists Apples with price, stock and link |
| 18 | Farmer stock | Add a product with an image (JPG/PNG/WEBP, under 2 MB) | Product visible to customers; an HTML file is rejected |
| 19 | Admin approval | Approve Pending Patch | Farmer can now add products |
| 20 | Admin | Suspend a farmer | Farmer disappears from public lists |
| 21 | Admin | Deactivate a customer | Customer can no longer log in; existing session is rejected |
| 22 | Admin | Add a market by clicking the map | Market appears in the public list |
| 23 | Moderation | Remove a review | Review gone and the product rating recalculated |
| 24 | Reports | Generate "Platform summary" | Totals, revenue per market and most active farmers |
| 25 | Announcements | Publish to customers | Customers see it and receive a notification |
