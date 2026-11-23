# Cricket Association Management & Live Scoring - API Documentation

Comprehensive REST API and WebSocket specification for the Cricket Association Management and Live Scoring platform.

Base URL: `/api`

---

## 1. Authentication & Identity (`/api/auth`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/send-registration-otp` | Public | Send 6-digit verification code to applicant email before registration. |
| POST | `/api/auth/verify-registration-otp` | Public | Verify 6-digit registration code. |
| POST | `/api/auth/check-registration-exists` | Public | Check if email/team/player is already registered. |
| POST | `/api/auth/check-team-exists` | Public | Check if team name or coach email already exists. |
| POST | `/api/auth/forgot-password/request-otp` | Public | Send 4-digit password reset OTP to member email. |
| POST | `/api/auth/forgot-password/verify-otp` | Public | Verify 4-digit password reset OTP. |
| POST | `/api/auth/forgot-password/reset-password` | Public | Encrypt and update account password with verified OTP. |
| POST | `/api/auth/login` | Public | Unified login with email/id and password or OTP. |
| POST | `/api/auth/admin/login` | Public | Dedicated Administrator login with password. |
| POST | `/api/auth/logout` | Public | Clear JWT session cookies and invalidate token. |
| GET | `/api/auth/logout` | Public | GET logout redirect handler. |
| GET | `/api/auth/me` | Bearer Token | Fetch authenticated profile details. |
| POST | `/api/auth/request-otp` | Public | Request login OTP for registered accounts. |
| POST | `/api/auth/verify-otp` | Public | Verify login OTP and receive JWT access token. |
| POST | `/api/auth/team/request-otp` | Public | Coach/Team specific login OTP request. |
| POST | `/api/auth/team/verify-otp` | Public | Coach/Team specific OTP verification. |
| POST | `/api/auth/player/request-otp` | Public | Player login OTP request. |
| POST | `/api/auth/player/verify-otp` | Public | Player OTP verification. |
| POST | `/api/auth/player/find-team` | Public | Find enrolled team name for player email. |
| POST | `/api/auth/register` | Public | Unified registration entrypoint. |
| POST | `/api/auth/register-player` | Public | Register player applicant with batting/bowling profiles. |
| POST | `/api/auth/register-team` | Public | Register club/team with coach credentials and 15 players. |
| POST | `/api/auth/register-scorer` | Public | Register certified official scorer applicant. |
| POST | `/api/auth/register-umpire` | Public | Register certified umpire applicant. |
| POST | `/api/auth/register-content` | Public | Register content creator applicant. |
| GET | `/api/auth/teams` | Public | Fetch approved teams list for dropdowns. |
| GET | `/api/auth/admin/all-registrations` | Admin | Review pending registrations across all roles. |
| POST | `/api/auth/admin/teams/:id/approve` | Admin | Approve pending team and activate squad. |
| POST | `/api/auth/admin/teams/:id/reject` | Admin | Reject pending team application. |
| POST | `/api/auth/admin/approve-registration` | Admin | Approve user registration (Player, Scorer, Umpire). |
| POST | `/api/auth/admin/reject-registration` | Admin | Reject user registration with reason. |
| POST | `/api/auth/admin/scorer-status` | Admin | Update official scorer status. |
| POST | `/api/auth/admin/umpire-status` | Admin | Update official umpire status. |
| GET | `/api/auth/admin/notifications` | Admin | Fetch admin registration alerts. |

---

## 2. Admin Management (`/api/admin`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/overview` | Admin | Comprehensive district metrics, revenue, active matches. |
| GET | `/api/admin/users` | Admin | Searchable and filterable user directory. |
| PUT | `/api/admin/users/:userId/status` | Admin | Suspend or activate member accounts. |
| GET | `/api/admin/teams` | Admin | Team directory with status and squad counts. |
| GET | `/api/admin/matches` | Admin | Association matches list with filters and pagination. |
| POST | `/api/admin/matches/schedule` | Admin | Schedule new tournament fixture. |
| PUT | `/api/admin/matches/:matchId/reschedule` | Admin | Reschedule match date, time, or venue. |
| PUT | `/api/admin/matches/:matchId/cancel` | Admin | Cancel scheduled match with official remarks. |
| GET | `/api/admin/venues` | Admin | List of approved cricket venues/grounds. |
| POST | `/api/admin/venues` | Admin | Register new cricket ground. |
| DELETE | `/api/admin/venues/:id` | Admin | Delete cricket venue. |
| GET | `/api/admin/officials` | Admin | Directory of certified scorers and umpires. |
| POST | `/api/admin/officials` | Admin | Register official. |
| DELETE | `/api/admin/officials/:id` | Admin | Delete official record. |
| GET | `/api/admin/audit-logs` | Admin | System security and action audit logs. |
| GET | `/api/admin/master-settings` | Public/Cached | Association master configuration values. |
| PUT | `/api/admin/master-settings` | Admin | Update master settings with audit logging. |

---

## 3. Team Portal (`/api/team`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/team/districts` | Public | District selection list for team registration. |
| POST | `/api/team/register` | Public | Register new cricket team with 15 squad players. |
| POST | `/api/team/login` | Public | Coach and club authentication. |
| GET | `/api/team/profile` | Team | Coach profile and team information. |
| PUT | `/api/team/profile` | Team | Update coach phone, email, and club bio. |
| POST | `/api/team/upload-photo` | Team | Upload and process team logo to WebP. |
| GET | `/api/team/squad` | Team | Full roster of players with status and statistics. |
| POST | `/api/team/players` | Team | Add player to squad roster. |
| PUT | `/api/team/players/:playerId` | Team | Update squad player info. |
| DELETE | `/api/team/players/:playerId` | Team | Remove player from team roster. |
| GET | `/api/team/matches` | Team | Team match schedule, past results, and scorecards. |
| GET | `/api/team/statistics` | Team | Team win/loss, NRR, runs, and wicket totals. |
| GET | `/api/team/players/statistics` | Team | Individual player statistics for team squad. |
| GET | `/api/team/notifications` | Team | Team inbox notifications and alerts. |
| PUT | `/api/team/notifications/:id/read` | Team | Mark notification as read. |

---

## 4. Player Portal (`/api/player` & `/api/players`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/player/register` | Public | Direct player registration. |
| POST | `/api/player/login` | Public | Player login using email and team name. |
| POST | `/api/player/verify-otp` | Public | Player OTP verification. |
| GET | `/api/player/profile` | Player | Authenticated player profile, batting/bowling styles. |
| PUT | `/api/player/profile` | Player | Update player profile info. |
| POST | `/api/player/upload-photo` | Player | Upload profile photo (converted to WebP). |
| GET | `/api/player/team` | Player | Player team affiliation and teammates list. |
| GET | `/api/player/matches` | Player | Matches played by player with personal scores. |
| GET | `/api/player/statistics` | Player | Career runs, batting average, strike rate, wickets. |
| GET | `/api/player/ratings` | Player | Current player performance rating. |
| GET | `/api/player/career-ratings` | Player | Historic rating timeline. |
| GET | `/api/player/form` | Player | Last 5 matches performance form factor. |
| GET | `/api/players/leaderboards/ratings` | Public | Top rated players leaderboard (Batting, Bowling, All-rounder). |

---

## 5. Live Scoring Engine (`/api/scorer`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/scorer/dashboard` | Scorer | Assigned matches for live scoring. |
| GET | `/api/scorer/matches/:matchId/setup` | Scorer | Match toss, squads, and venue details. |
| POST | `/api/scorer/matches/:matchId/start` | Scorer | Record toss result and start match (SCHEDULED -> LIVE). |
| POST | `/api/scorer/matches/:matchId/deliveries` | Scorer | Record ball-by-ball delivery (runs, extras, wickets). |
| POST | `/api/scorer/matches/:matchId/undo` | Scorer | Transaction-safe undo of last delivery. |
| PUT | `/api/scorer/matches/:matchId/deliveries/:deliveryId` | Scorer | Correct recorded delivery with scorecard recalculation. |
| POST | `/api/scorer/matches/:matchId/end-over` | Scorer | Complete over and assign next bowler. |
| POST | `/api/scorer/matches/:matchId/swap-strike` | Scorer | Manual strike swap between striker and non-striker. |
| POST | `/api/scorer/matches/:matchId/change-batter` | Scorer | Substitute batter at crease. |
| POST | `/api/scorer/matches/:matchId/change-bowler` | Scorer | Change bowler (supports mid-over injury & Law 41.7). |
| POST | `/api/scorer/matches/:matchId/end-innings` | Scorer | Conclude 1st innings or calculate match winner. |
| POST | `/api/scorer/matches/:matchId/start-next-innings` | Scorer | Start 2nd innings chase. |
| POST | `/api/scorer/matches/:matchId/end` | Scorer | Manually conclude match. |
| POST | `/api/scorer/matches/:matchId/penalty` | Scorer | Record 5-run batting/bowling penalty. |
| POST | `/api/scorer/matches/:matchId/other-wicket` | Scorer | Record retired hurt, timed out, or mankading. |
| POST | `/api/scorer/matches/:matchId/super-over` | Scorer | Initiate Super Over when scores are tied. |
| POST | `/api/scorer/matches/:matchId/revised-overs` | Scorer | Apply rain interruption revised overs/target. |
| POST | `/api/scorer/matches/:matchId/playing-xi` | Scorer | Edit Playing XI before player participates. |
| POST | `/api/scorer/matches/:matchId/breaks` | Scorer | Add match break (Lunch, Tea, Drinks, Rain). |
| POST | `/api/scorer/matches/:matchId/end-break` | Scorer | Resume match from break. |

---

## 6. Public Portal & Tournaments (`/api/portal`, `/api/tournaments`, `/api/matches`, `/api/news`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/portal/home` | Public/Cached | Portal landing page data (live matches, upcoming, banners). |
| GET | `/api/portal/stats` | Public/Cached | District tournament statistics and records. |
| GET | `/api/portal/search` | Public | Global search for teams, players, tournaments. |
| GET | `/api/portal/teams/:teamId` | Public | Public team profile and squad list. |
| GET | `/api/portal/players/:playerId` | Public | Public player profile and career stats. |
| GET | `/api/matches` | Public | Filterable match fixtures and results list. |
| GET | `/api/matches/:id/scorecard` | Public | Complete ball-by-ball scorecard, batting and bowling. |
| GET | `/api/tournaments` | Public | Active tournaments list. |
| GET | `/api/tournaments/:id` | Public | Tournament details, schedule, points table. |
| GET | `/api/tournaments/:id/points-table` | Public/Cached | Standings table with NRR calculation. |
| GET | `/api/news` | Public/Cached | Official association announcements and press releases. |
| GET | `/api/cricket-laws` | Public/Cached | MCC Laws of Cricket reference library. |
| GET | `/api/health` | Public | Production system health and DB ping check. |

---

## 7. Socket.IO Real-Time Events

- Connection: `ws://<HOST>:5000`
- Match Room: Clients join `match:<matchId>` via `socket.emit('join:match', matchId)`
- Events Emitted:
  - `score:update`: Minimal payload containing live score, overs, last ball event, active batters, and bowler.
  - `OVER_COMPLETED`: Over finished, new bowler assignment.
  - `BREAK_ADDED` / `BREAK_ENDED`: Match break status updates.
  - `SUPER_OVER_STARTED`: Super over activation.
