# Test Cases: Doctor Schedule Controller

**Controller:** `DoctorScheduleController`  
**Files:** 
- `src/modules/doctor/doctor-schedule.controller.ts`
- `src/modules/doctor/doctor-schedule.service.ts`

| Test Case ID | API Endpoint & Method | Type | Description | Pre-condition | Input | Expected Output | Post-condition | Tool |
|---|---|---|---|---|---|---|---|---|
| TC-DoctorSchedule-01 | `GET /doctors/:doctorId/schedules` | Happy | Retrieve all schedules for a doctor | Doctor exists and has schedules | `doctorId`: valid UUID | 200 OK, List of schedules sorted by day/time | None | Jest/Postman |
| TC-DoctorSchedule-02 | `GET /doctors/:doctorId/schedules` | Negative | Retrieve schedules with invalid UUID | None | `doctorId`: "invalid-uuid" | 400 Bad Request (Validation failed) | None | Postman |
| TC-DoctorSchedule-03 | `GET /doctors/:doctorId/schedules` | Performance | Retrieve large number of schedules | Doctor has 100+ schedules | `doctorId`: valid UUID | 200 OK, response time < 200ms | None | k6/JMeter |
| TC-DoctorSchedule-04 | `GET /doctors/:doctorId/schedules/available` | Happy | Retrieve available schedules (effective date filtered) | Doctor has active schedules | `doctorId`: valid UUID, `dayOfWeek`: optional | 200 OK, List of available schedules | None | Jest |
| TC-DoctorSchedule-05 | `GET /doctors/:doctorId/schedules/:id` | Happy | Get specific schedule details | Schedule exists | `id`: valid UUID | 200 OK, Schedule object | None | Jest |
| TC-DoctorSchedule-06 | `GET /doctors/:doctorId/schedules/:id` | Negative | Get non-existent schedule | None | `id`: random UUID | 404 Not Found | None | Postman |
| TC-DoctorSchedule-07 | `POST /doctors/:doctorId/schedules` | Happy | Create REGULAR schedule | No conflict | Body: `{ dayOfWeek: 1, startTime: "08:00", endTime: "12:00", type: "REGULAR" ... }` | 201 Created, Schedule object | Record created in DB | Jest |
| TC-DoctorSchedule-08 | `POST /doctors/:doctorId/schedules` | Happy | Create BLOCK_OUT schedule (Day off) | None | Body: `{ dayOfWeek: 2, type: "BLOCK_OUT", note: "Sick leave" }` | 201 Created, `isAvailable`: false | Record created as unavailable | Postman |
| TC-DoctorSchedule-09 | `POST /doctors/:doctorId/schedules` | Edge | Create schedule with min slot duration (5m) | None | `slotDuration`: 5, `startTime`: "08:00", `endTime`: "08:05" | 201 Created | Record created | Jest |
| TC-DoctorSchedule-10 | `POST /doctors/:doctorId/schedules` | Negative | Create schedule with `startTime` >= `endTime` | None | `startTime`: "14:00", `endTime`: "13:00" | 400 Bad Request | None | Postman |
| TC-DoctorSchedule-11 | `POST /doctors/:doctorId/schedules` | Negative | Create schedule overlapping existing one | Schedule exists 08:00-12:00 | Body: `09:00-10:00` (Same priority) | 409 Conflict | None | Jest |
| TC-DoctorSchedule-12 | `POST /doctors/:doctorId/schedules` | Security | Create schedule for another doctor | Logged in as Doctor A | `doctorId`: Doctor B's ID | 403 Forbidden (Ownership Guard) | None | Manual/Jest |
| TC-DoctorSchedule-13 | `POST /doctors/:doctorId/schedules` | Negative | Missing `hospitalId` for IN_CLINIC | None | `appointmentType`: "IN_CLINIC", `hospitalId`: null | 400 Bad Request | None | Postman |
| TC-DoctorSchedule-14 | `POST /doctors/:doctorId/schedules` | Race Condition | Double booking (simultaneous creates) | None | 2 requests exactly same time for same slot | 1 succeeds (201), 1 fails (409) | DB integrity maintained | k6/Script |
| TC-DoctorSchedule-15 | `POST /doctors/:doctorId/schedules/bulk` | Happy | Bulk create multiple schedules | No overlap | Body: `{ schedules: [ {Mon 8-12}, {Tue 8-12} ] }` | 201 Created, Array of schedules | All records created | Jest |
| TC-DoctorSchedule-16 | `POST /doctors/:doctorId/schedules/bulk` | Negative | Bulk create with internal overlap | None | Body: `{ schedules: [ {Mon 8-10}, {Mon 9-11} ] }` | 409 Conflict | Transaction rolled back | Jest |
| TC-DoctorSchedule-17 | `POST /doctors/:doctorId/schedules/bulk` | Performance | Bulk create max limit (20 items) | None | Body with 20 valid schedules | 201 Created, < 1000ms | 20 records created | k6 |
| TC-DoctorSchedule-18 | `POST /doctors/:doctorId/schedules/bulk-holiday` | Happy | Create holiday/block-out range | None | `startDate`: "2024-01-01", `endDate`: "2024-01-05", `days`: [1-5] | 201 Created | Multiple BLOCK_OUT schedules created | Postman |
| TC-DoctorSchedule-19 | `POST /doctors/:doctorId/schedules/bulk-holiday` | Negative | Invalid date range (Start > End) | None | `startDate`: "2024-02-01", `endDate`: "2024-01-01" | 400 Bad Request | None | Jest |
| TC-DoctorSchedule-20 | `POST /doctors/:doctorId/schedules/:scheduleId/generate-slots` | Happy | Generate time slots from schedule | Schedule exists | `startDate`, `endDate` valid | 201 Created, List of slots | Slots saved to `time_slot` table | Jest |
| TC-DoctorSchedule-21 | `POST /doctors/:doctorId/schedules/:scheduleId/generate-slots` | Negative | Generate slots > 90 days range | Schedule exists | Range > 90 days | 400 Bad Request | None | Postman |
| TC-DoctorSchedule-22 | `PUT /doctors/:doctorId/schedules/:id` | Happy | Update schedule time | Schedule exists | `startTime`: "08:30" | 200 OK, Updated schedule | DB updated | Jest |
| TC-DoctorSchedule-23 | `PUT /doctors/:doctorId/schedules/:id` | Negative | Update causes overlap | Other schedule exists nearby | Shift time to overlap | 409 Conflict | Update rejected | Jest |
| TC-DoctorSchedule-24 | `PUT /doctors/:doctorId/schedules/:id` | Security | Update another doctor's schedule | Logged in as Doctor A | `id`: Doctor B's schedule | 403 Forbidden | None | Manual |
| TC-DoctorSchedule-25 | `DELETE /doctors/:doctorId/schedules/:id` | Happy | Delete a schedule | Schedule exists | `id`: valid UUID | 200 OK | Record deleted | Postman |
| TC-DoctorSchedule-26 | `DELETE /doctors/:doctorId/schedules/:id` | Negative | Delete non-existent schedule | None | `id`: random UUID | 404 Not Found | None | Jest |
| TC-DoctorSchedule-27 | `DELETE /doctors/:doctorId/schedules/:id` | Security | Delete another doctor's schedule | Logged in as Doctor A | `id`: Doctor B's schedule | 403 Forbidden | None | Jest |
