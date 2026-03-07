# NgocKy Test Plan

This document outlines manual and planned automated test cases for verifying the NgocKy application.

---

## 🏗 General UI/UX

| ID | Test Case | Target Page | Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| G-1 | Mandatory Fields | All Modals | Click 'Create' with empty fields. | Red asterisks are visible; empty fields show 'required' error. |
| G-2 | Navigation | All Pages | Click sidebar items. | Each page loads correctly with relevant data. |
| G-3 | Desktop vs Mobile | All Pages | Resize browser to <768px. | Mobile menu (bottom bar) appears; layout remains usable. |

---

## 🔐 Authentication

| ID | Test Case | Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| AU-1 | Login (Valid) | Enter correct email/password. | Redirects to Dashboard. |
| AU-2 | Login (Invalid) | Enter wrong password. | Shows 'Login failed' message. |
| AU-3 | Logout | Click logout button. | Redirects to Login; tokens are cleared. |
| AU-4 | Token Refresh | Wait for token expiry (15m) or delete `accessToken`. | App silently refreshes token via HTTP-only cookie. |

---

## 🏆 Goals Tracking

| ID | Test Case | Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| GL-1 | Create Goal (Frequency) | Create "Gym" goal with target 3 times/week. | Shows "0/3 times" progress. |
| GL-2 | Create Goal (Quantity) | Create "Read" goal with target 60 mins/day. | Shows "0/60 mins" progress. |
| GL-3 | Check-in (Same Day) | Click '+' today. | Progress increases (1/3 or adds quantity). |
| GL-4 | Check-in (Future) | Select future date in check-in modal. | Modal shows validation error (cannot check-in to future). |
| GL-5 | Check-in (Over 45 days) | Select date >45 days ago. | Modal shows validation error. |
| GL-6 | Delete Goal | Click delete (trash icon). | Goal is removed immediately from list after confirmation. |

---

## 📽 Projects & Tasks (Kanban)

| ID | Test Case | Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| PR-1 | Create Board | Create board "House Renovation". | Board appears in selection list. |
| PR-2 | Select Project | Click a board card. | Navigates to the Kanban board for that project. |
| PR-3 | Create Task | Click 'New Task' in a board. | Task appears in the 'PLANNED' column. |
| PR-4 | Drag & Drop | Drag task from 'PLANNED' to 'IN_PROGRESS'. | Task status updates immediately (requires board reload verification). |
| PR-5 | Edit Task | Click task card. | Modal opens with task details; changes are savable. |

---

## 💰 Expenses

| ID | Test Case | Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| EX-1 | Add Expense | Fill description, $20, Category: Food. | Expense list updates; Total amount increases by $20. |
| EX-2 | Filter Category | Select 'Food' in filter. | List only shows Food expenses. |
| EX-3 | Filter Scope | Select 'Family' vs 'Personal'. | Totals and list filter correctly. |

---

## 🔔 Alerts & Notifications

| ID | Test Case | Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| AL-1 | Create Rule | Create daily alert for Overdue Tasks. | Rule appears in 'Alert Rules' list. |
| AL-2 | Toggle Rule | Click 'ENABLED' badge. | Rule toggles to 'DISABLED'. |
| AL-3 | Schedule Report | Create weekly summary for 8:00 AM. | Schedule appears in 'Scheduled Reports' list. |
