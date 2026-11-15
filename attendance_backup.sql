--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9
-- Dumped by pg_dump version 16.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AttendanceRecord; Type: TABLE; Schema: public; Owner: attendance_user
--

CREATE TABLE public."AttendanceRecord" (
    id text NOT NULL,
    "lectureId" text NOT NULL,
    "studentId" text,
    "studentCode" text,
    "studentName" text NOT NULL,
    status text DEFAULT 'PRESENT'::text NOT NULL,
    "deviceId" text,
    "ipAddress" text,
    "registeredAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    note text
);


ALTER TABLE public."AttendanceRecord" OWNER TO attendance_user;

--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: attendance_user
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    "actorUserId" text,
    action text NOT NULL,
    "entityType" text NOT NULL,
    "entityId" text,
    details text,
    "ipAddress" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."AuditLog" OWNER TO attendance_user;

--
-- Name: Course; Type: TABLE; Schema: public; Owner: attendance_user
--

CREATE TABLE public."Course" (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    stage integer NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    type text DEFAULT 'THEORETICAL'::text
);


ALTER TABLE public."Course" OWNER TO attendance_user;

--
-- Name: Lecture; Type: TABLE; Schema: public; Owner: attendance_user
--

CREATE TABLE public."Lecture" (
    id text NOT NULL,
    name text NOT NULL,
    "studyPeriod" text DEFAULT 'MORNING'::text NOT NULL,
    section text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "qrToken" text NOT NULL,
    "qrExpiresAt" timestamp(3) without time zone NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "closedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdByUserId" text,
    "conductedByUserId" text,
    "courseId" text,
    "deletedAt" timestamp(3) without time zone,
    "sectionId" text
);


ALTER TABLE public."Lecture" OWNER TO attendance_user;

--
-- Name: LectureSection; Type: TABLE; Schema: public; Owner: attendance_user
--

CREATE TABLE public."LectureSection" (
    "lectureId" text NOT NULL,
    "sectionId" text NOT NULL
);


ALTER TABLE public."LectureSection" OWNER TO attendance_user;

--
-- Name: Section; Type: TABLE; Schema: public; Owner: attendance_user
--

CREATE TABLE public."Section" (
    id text NOT NULL,
    "studyPeriod" text DEFAULT 'MORNING'::text NOT NULL,
    name text NOT NULL,
    label text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    stage integer DEFAULT 2 NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Section" OWNER TO attendance_user;

--
-- Name: StaffSession; Type: TABLE; Schema: public; Owner: attendance_user
--

CREATE TABLE public."StaffSession" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "tokenHash" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "ipAddress" text,
    "userAgent" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lastUsedAt" timestamp(3) without time zone
);


ALTER TABLE public."StaffSession" OWNER TO attendance_user;

--
-- Name: StaffUser; Type: TABLE; Schema: public; Owner: attendance_user
--

CREATE TABLE public."StaffUser" (
    id text NOT NULL,
    "staffId" text NOT NULL,
    "fullName" text NOT NULL,
    role text NOT NULL,
    "passwordHash" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "failedLoginCount" integer DEFAULT 0 NOT NULL,
    "lockedUntil" timestamp(3) without time zone,
    "lastLoginAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."StaffUser" OWNER TO attendance_user;

--
-- Name: Student; Type: TABLE; Schema: public; Owner: attendance_user
--

CREATE TABLE public."Student" (
    id text NOT NULL,
    "orderIndex" integer,
    "studentCode" text NOT NULL,
    name text NOT NULL,
    "studyPeriod" text DEFAULT 'MORNING'::text NOT NULL,
    section text,
    "presentCount" integer DEFAULT 0 NOT NULL,
    "absentCount" integer DEFAULT 0 NOT NULL,
    "totalSessions" integer,
    rate double precision,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    stage integer DEFAULT 2 NOT NULL,
    "sectionId" text,
    "deletedAt" timestamp(3) without time zone
);


ALTER TABLE public."Student" OWNER TO attendance_user;

--
-- Name: StudentQrToken; Type: TABLE; Schema: public; Owner: attendance_user
--

CREATE TABLE public."StudentQrToken" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    token text NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "createdByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."StudentQrToken" OWNER TO attendance_user;

--
-- Name: SystemSetting; Type: TABLE; Schema: public; Owner: attendance_user
--

CREATE TABLE public."SystemSetting" (
    key text NOT NULL,
    value text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."SystemSetting" OWNER TO attendance_user;

--
-- Name: TeachingAssignment; Type: TABLE; Schema: public; Owner: attendance_user
--

CREATE TABLE public."TeachingAssignment" (
    id text NOT NULL,
    "staffUserId" text NOT NULL,
    "courseId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."TeachingAssignment" OWNER TO attendance_user;

--
-- Name: TimetableEntry; Type: TABLE; Schema: public; Owner: attendance_user
--

CREATE TABLE public."TimetableEntry" (
    id text NOT NULL,
    "courseId" text NOT NULL,
    "sectionId" text NOT NULL,
    "dayOfWeek" integer NOT NULL,
    "startTime" text NOT NULL,
    "endTime" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    type text DEFAULT 'THEORETICAL'::text,
    hall text
);


ALTER TABLE public."TimetableEntry" OWNER TO attendance_user;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: attendance_user
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO attendance_user;

--
-- Data for Name: AttendanceRecord; Type: TABLE DATA; Schema: public; Owner: attendance_user
--

COPY public."AttendanceRecord" (id, "lectureId", "studentId", "studentCode", "studentName", status, "deviceId", "ipAddress", "registeredAt", "createdAt", note) FROM stdin;
\.


--
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: attendance_user
--

COPY public."AuditLog" (id, "actorUserId", action, "entityType", "entityId", details, "ipAddress", "createdAt") FROM stdin;
f4e81271-e758-4baa-8b40-d01ea7feb396	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_CREATE	Course	181f8904-c74b-4552-bfa2-34320917743b	HEM - أمراض الدم 1 (stage 2)	\N	2026-11-11 14:01:29.705
cb48abd4-fca1-4752-a7e0-bb90c6003d6e	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_CREATE	Course	2622aa44-a0fe-49d1-969b-4a485d62296a	CC - كيمياء سريرية 1 (stage 2)	\N	2026-11-11 14:01:39.113
4d63a0a8-4c6c-45e0-86aa-7c0086d09178	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_CREATE	Course	349a1970-6ada-4479-b97d-15fb1cacddbb	RAR - الطفيليات الابتدائية (stage 2)	\N	2026-11-11 14:01:50.283
ba432dfc-87ce-4059-917f-b1fd40868b05	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_CREATE	Course	1441e34d-f326-40cf-9d75-0fd96ac3da2f	MIC - الأحياء المجهرية (stage 2)	\N	2026-11-11 14:01:59.075
55fff550-b797-452d-b747-fbe4155a72cf	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_CREATE	Course	11e80dca-9baa-4ca6-8383-b9c45df626ba	IMM - علم المناعة (stage 2)	\N	2026-11-11 14:02:06.817
85f34ad9-3c06-4cee-9f3a-f6d5c369743d	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_CREATE	Course	e16de310-b49a-480e-8d63-b63f15dc3ef7	PE - السلوك المهني (stage 2)	\N	2026-11-11 14:02:15.659
de8d5088-86c0-4977-8052-953a54de2c62	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_CREATE	Course	a0c103a8-cb31-4cb9-af84-10cd8cdf3c4b	VIR - الفايروسات (stage 2)	\N	2026-11-11 14:02:22.632
0ade6c97-d6a0-40f0-8d85-63da403d263b	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_CREATE	Course	3e1b1e09-3d59-4a0c-b9e7-5dd614cf9f25	AR - اللغة العربية (stage 2)	\N	2026-11-11 14:02:27.493
1d41a805-e7f1-4cf1-b2ec-552211a795ca	\N	AUTH_LOGIN_FAILED	StaffUser	\N	unknown staff id	127.0.0.1	2026-11-11 14:06:56.153
6e4201fe-371d-4835-a02e-c23bd5432ad1	\N	AUTH_LOGIN_FAILED	StaffUser	\N	unknown staff id	127.0.0.1	2026-11-11 14:07:06.291
aaf8627a-76f1-4c93-8027-a980af0b0cd5	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_UPDATE	Course	3e1b1e09-3d59-4a0c-b9e7-5dd614cf9f25	AR - اللغة العربية (stage 2)	\N	2026-11-11 14:23:46.776
50651857-6514-4db1-b475-a6f731dccf16	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_UPDATE	Course	2622aa44-a0fe-49d1-969b-4a485d62296a	CC - كيمياء سريرية 1 (stage 2)	\N	2026-11-11 14:23:50.441
a7ffa3b7-1d30-42fc-b2f9-4fc87b31705e	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_UPDATE	Course	181f8904-c74b-4552-bfa2-34320917743b	HEM - أمراض الدم 1 (stage 2)	\N	2026-11-11 14:23:52.891
b4f37d8f-74dd-48a9-8b2b-f4396a610eec	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_UPDATE	Course	11e80dca-9baa-4ca6-8383-b9c45df626ba	IMM - علم المناعة (stage 2)	\N	2026-11-11 14:23:55.519
8c640b1e-cdc2-4bb6-84bc-7b7caa2e5615	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_UPDATE	Course	1441e34d-f326-40cf-9d75-0fd96ac3da2f	MIC - الأحياء المجهرية (stage 2)	\N	2026-11-11 14:23:58.7
7b341779-bf28-424b-b01a-771d9b2b445c	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_UPDATE	Course	e16de310-b49a-480e-8d63-b63f15dc3ef7	PE - السلوك المهني (stage 2)	\N	2026-11-11 14:24:00.923
35426b7d-0088-41b1-98ce-6086c15f4e25	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_UPDATE	Course	349a1970-6ada-4479-b97d-15fb1cacddbb	RAR - الطفيليات الابتدائية (stage 2)	\N	2026-11-11 14:24:06.26
9db4698c-b20e-4a26-b7a9-bc3ff0c38ea5	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_UPDATE	Course	a0c103a8-cb31-4cb9-af84-10cd8cdf3c4b	VIR - الفايروسات (stage 2)	\N	2026-11-11 14:24:09.15
423174ab-f232-4166-8355-c33d2ab7f75b	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_UPDATE	Course	3e1b1e09-3d59-4a0c-b9e7-5dd614cf9f25	AR - اللغة العربية (stage 2)	\N	2026-11-11 14:24:21.619
21d0d9b3-025b-46ec-aeb3-29af7a197e05	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_UPDATE	Course	2622aa44-a0fe-49d1-969b-4a485d62296a	CC - كيمياء سريرية 1 (stage 2)	\N	2026-11-11 14:24:57.123
30583e2a-817b-41c5-9895-3d5b65d47340	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_UPDATE	Course	1441e34d-f326-40cf-9d75-0fd96ac3da2f	MIC - الأحياء المجهرية (stage 2)	\N	2026-11-11 14:25:01.955
5d32c317-e92d-40b3-bd14-448c63d974df	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_UPDATE	Course	1441e34d-f326-40cf-9d75-0fd96ac3da2f	MIC - الأحياء المجهرية (stage 2)	\N	2026-11-11 14:29:35.215
223190af-234c-4201-be9a-6130609bd0a1	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_UPDATE	Course	e16de310-b49a-480e-8d63-b63f15dc3ef7	PE - السلوك المهني (stage 2)	\N	2026-11-11 14:29:46.883
e44abcfb-f1b9-4cfa-a7d4-cdcefccd089e	881930b1-ac6d-40e9-aed4-23b38a1530c6	STAFF_CREATED	StaffUser	587739c5-2564-41b3-8cb2-47b42e719547	staffId=aqeel-slman; role=LECTURER	127.0.0.1	2026-11-11 14:35:44.203
85f83725-24ec-49d1-ab2b-cbf0ca71cf29	881930b1-ac6d-40e9-aed4-23b38a1530c6	STAFF_CREATED	StaffUser	3a6afe48-9b8f-46ff-a872-344f5699554e	staffId=zainab-abdul-fattah; role=LECTURER	127.0.0.1	2026-11-11 14:38:20.044
542937f3-8fa4-407e-84da-a6888a6cce13	881930b1-ac6d-40e9-aed4-23b38a1530c6	STAFF_CREATED	StaffUser	73c99a10-a816-4747-9cb9-eacd7fe06f83	staffId=jaafar-half; role=LECTURER	127.0.0.1	2026-11-11 14:38:57.192
8e143891-070a-42bb-b675-f7a6f1488fb9	881930b1-ac6d-40e9-aed4-23b38a1530c6	STAFF_DELETED	StaffUser	587739c5-2564-41b3-8cb2-47b42e719547	staffId=aqeel-slman; role=LECTURER; archived=false	127.0.0.1	2026-11-11 14:40:42.004
ccd77246-2e86-460c-92cc-39d0aa9dab49	881930b1-ac6d-40e9-aed4-23b38a1530c6	STAFF_DELETED	StaffUser	73c99a10-a816-4747-9cb9-eacd7fe06f83	staffId=jaafar-half; role=LECTURER; archived=false	127.0.0.1	2026-11-11 14:40:43.292
2ea605dd-71cb-46e9-8ea6-bdfde30a3712	881930b1-ac6d-40e9-aed4-23b38a1530c6	STAFF_DELETED	StaffUser	3a6afe48-9b8f-46ff-a872-344f5699554e	staffId=zainab-abdul-fattah; role=LECTURER; archived=false	127.0.0.1	2026-11-11 14:40:44.676
0788fc87-cfb5-4185-8ac6-6fdf8e470450	881930b1-ac6d-40e9-aed4-23b38a1530c6	ASSIGNMENT_CREATE	TeachingAssignment	1c20294f-af32-431d-9a02-a8da135d0e12	عقيل سلمان -> HEM (أمراض الدم 1, stage 2)	\N	2026-11-11 14:45:45.535
6b9c56e3-a910-4ed8-b465-3975bdcdedb8	881930b1-ac6d-40e9-aed4-23b38a1530c6	ASSIGNMENT_CREATE	TeachingAssignment	17e4cac4-c68a-4971-9ae4-e88cee6dc3cb	د. زينب عبد الفتاح -> HEM (أمراض الدم 1, stage 2)	\N	2026-11-11 14:46:11.814
c889d469-ff76-4fd5-9967-e34a1f4f2e95	881930b1-ac6d-40e9-aed4-23b38a1530c6	ASSIGNMENT_CREATE	TeachingAssignment	e5a22ead-c75b-4450-a538-7a9cafb80e95	د. جعفر حلف -> CC (كيمياء سريرية 1, stage 2)	\N	2026-11-11 14:46:48.922
b957d96f-d17c-42e5-bad1-5d53b390dc8e	881930b1-ac6d-40e9-aed4-23b38a1530c6	ASSIGNMENT_CREATE	TeachingAssignment	9f6a171e-a873-4728-a1f6-5f7342d816e3	حسين يوسف -> CC (كيمياء سريرية 1, stage 2)	\N	2026-11-11 14:46:55.718
cc7658cb-f919-47b3-8174-dcdc1623d529	881930b1-ac6d-40e9-aed4-23b38a1530c6	ASSIGNMENT_CREATE	TeachingAssignment	8395859e-4f81-48bd-9469-31a1c597a3ce	هديل صالح -> RAR (الطفيليات الابتدائية, stage 2)	\N	2026-11-11 14:47:07.84
54f341c5-510f-48ca-ae1a-8e2b65d562e5	881930b1-ac6d-40e9-aed4-23b38a1530c6	ASSIGNMENT_CREATE	TeachingAssignment	35a4bf80-b503-4a10-9251-6ce6d40c04c1	إسراء جواد -> RAR (الطفيليات الابتدائية, stage 2)	\N	2026-11-11 14:47:21.483
a05ac5fd-2507-4525-a7fa-d190ea8b3b71	881930b1-ac6d-40e9-aed4-23b38a1530c6	ASSIGNMENT_CREATE	TeachingAssignment	508f095c-a18e-4f6d-94b0-307f159d7e09	د. بلقيس عبد علي -> MIC (الأحياء المجهرية, stage 2)	\N	2026-11-11 14:47:48.429
2c91209a-2dc2-46b2-a7e9-c9b380f7bd99	881930b1-ac6d-40e9-aed4-23b38a1530c6	ASSIGNMENT_CREATE	TeachingAssignment	5fbb3ee7-1e6b-4563-827c-2bfbb98d7224	د. آمال صاحب -> MIC (الأحياء المجهرية, stage 2)	\N	2026-11-11 14:47:55.341
4d8ab5f3-0d3e-4a81-81ef-38bdad8ec9d9	881930b1-ac6d-40e9-aed4-23b38a1530c6	ASSIGNMENT_CREATE	TeachingAssignment	699c9008-3788-44b4-96ab-d3bdbe5fcdcc	زهراء قيس -> PE (السلوك المهني, stage 2)	\N	2026-11-11 14:48:52.542
2be414a6-92dc-414b-a33e-524c8e59419a	881930b1-ac6d-40e9-aed4-23b38a1530c6	ASSIGNMENT_CREATE	TeachingAssignment	daed5cb5-a50e-439e-98f6-3a9fe5e3a226	د. سالم حسين -> IMM (علم المناعة, stage 2)	\N	2026-11-11 14:48:11.918
86d197bc-e45a-405b-849a-d81c348f047e	881930b1-ac6d-40e9-aed4-23b38a1530c6	ASSIGNMENT_CREATE	TeachingAssignment	1879edc8-4ba5-4428-b34c-1de4c1a16871	مصطفى حسن -> MIC (الأحياء المجهرية, stage 2)	\N	2026-11-11 14:49:18.407
9dcea194-1a94-47d9-9d22-18c94428d6b0	881930b1-ac6d-40e9-aed4-23b38a1530c6	ASSIGNMENT_CREATE	TeachingAssignment	4490cede-7937-4156-b090-6164da31cd2b	آسيا جواد -> VIR (الفايروسات, stage 2)	\N	2026-11-11 14:49:45.958
b34d897f-d88d-4cc6-8861-80ee62cc1d13	881930b1-ac6d-40e9-aed4-23b38a1530c6	ASSIGNMENT_CREATE	TeachingAssignment	63568a5b-4f3f-4572-ae4c-042626a4522d	مهند عبد مسلم -> AR (اللغة العربية, stage 2)	\N	2026-11-11 14:49:57.579
54eee377-25e3-4b0e-a818-331afc84549c	881930b1-ac6d-40e9-aed4-23b38a1530c6	ASSIGNMENT_CREATE	TeachingAssignment	78449566-adb4-428d-a3be-b3ddf18f3330	د. رؤى نوري -> IMM (علم المناعة, stage 2)	\N	2026-11-11 14:48:33.54
b0f9bca6-ded7-45e2-938c-edbe098aa8d6	881930b1-ac6d-40e9-aed4-23b38a1530c6	ASSIGNMENT_CREATE	TeachingAssignment	4fe733dc-e699-4576-be09-364152f3e77c	محمد رياض -> MIC (الأحياء المجهرية, stage 2)	\N	2026-11-11 14:49:11.892
4fd44ac9-f46d-4bdc-8aaf-d2478197a3b4	881930b1-ac6d-40e9-aed4-23b38a1530c6	ASSIGNMENT_CREATE	TeachingAssignment	dc1942b8-3e75-49a4-adbd-8dd536255271	سالم فاهم -> MIC (الأحياء المجهرية, stage 2)	\N	2026-11-11 14:50:51.445
f1fca04e-af51-4a33-a440-bcb6183975cf	881930b1-ac6d-40e9-aed4-23b38a1530c6	ASSIGNMENT_CREATE	TeachingAssignment	0f1f20a2-7d9e-4756-9566-f2f6e3c81ebc	نوران علي -> IMM (علم المناعة, stage 2)	\N	2026-11-11 14:51:22.666
d05df575-9a02-4c71-96e2-0da0fac287f3	881930b1-ac6d-40e9-aed4-23b38a1530c6	ASSIGNMENT_CREATE	TeachingAssignment	d618fbb2-5375-4a14-a1eb-c627783f312a	زهراء رسول -> IMM (علم المناعة, stage 2)	\N	2026-11-11 14:51:37.108
4a93678f-bcce-4859-b3d6-02b9b71c5910	881930b1-ac6d-40e9-aed4-23b38a1530c6	ASSIGNMENT_CREATE	TeachingAssignment	056d7689-a466-40e7-9233-a9548e1edaba	محمد هادي -> RAR (الطفيليات الابتدائية, stage 2)	\N	2026-11-11 14:51:49.327
644837a0-2f3c-48e0-841f-0b511acc8688	881930b1-ac6d-40e9-aed4-23b38a1530c6	ASSIGNMENT_CREATE	TeachingAssignment	70e3fae1-7001-4ef1-8e8d-94370a8679a8	حيدر علي -> RAR (الطفيليات الابتدائية, stage 2)	\N	2026-11-11 14:51:57.037
df5a737b-8ba7-428c-9196-23e6c0ae182d	881930b1-ac6d-40e9-aed4-23b38a1530c6	ASSIGNMENT_CREATE	TeachingAssignment	a38118f6-928f-487a-bb0e-f16831635e2f	علي مهدي -> VIR (الفايروسات, stage 2)	\N	2026-11-11 14:52:03.667
ecd07d98-70e0-46bd-a574-c342021056f8	881930b1-ac6d-40e9-aed4-23b38a1530c6	ASSIGNMENT_CREATE	TeachingAssignment	ed05fb12-93e1-4b19-ac8b-18b6199da74b	عزيز مهنا خلف -> VIR (الفايروسات, stage 2)	\N	2026-11-11 14:52:10.03
ce41f288-94f1-45e5-aa97-d469694cb51b	881930b1-ac6d-40e9-aed4-23b38a1530c6	ASSIGNMENT_CREATE	TeachingAssignment	fa890b14-1700-4c82-995e-050068816446	قاسم زغير -> CC (كيمياء سريرية 1, stage 2)	\N	2026-11-11 14:52:22.821
016afa59-9350-441a-9b3e-7e234bf41f05	881930b1-ac6d-40e9-aed4-23b38a1530c6	ASSIGNMENT_CREATE	TeachingAssignment	b5ae26c1-8831-4b71-a2d1-5922c98865d3	أحمد حسين -> CC (كيمياء سريرية 1, stage 2)	\N	2026-11-11 14:52:31.157
52e4c44d-8692-4685-ab26-2db453a7a654	881930b1-ac6d-40e9-aed4-23b38a1530c6	ASSIGNMENT_CREATE	TeachingAssignment	7bdbd5bc-dd1d-436c-96c2-a10e328ca50f	سالم فاهم -> HEM (أمراض الدم 1, stage 2)	\N	2026-11-11 14:52:43.599
73094cc3-bf67-4e56-9a50-f637e11ef56d	881930b1-ac6d-40e9-aed4-23b38a1530c6	ASSIGNMENT_CREATE	TeachingAssignment	669ae1f8-483a-469a-a43c-7ccd2c0b05cf	زهراء أحمد ميري -> HEM (أمراض الدم 1, stage 2)	\N	2026-11-11 14:52:54.309
0db7c8b7-a8d3-4ae8-8a30-7160b4fa772f	881930b1-ac6d-40e9-aed4-23b38a1530c6	SECTION_DELETE	Section	ed224199-efd2-40dc-b2ab-92511701a721	stage=2, MORNING, 1	\N	2026-11-11 16:29:56.826
9fcbf9b5-fe96-4f17-964e-5542e1c818b2	881930b1-ac6d-40e9-aed4-23b38a1530c6	SECTION_DELETE	Section	4986c87f-60c0-44ab-bf3f-fc91048acd44	stage=2, MORNING, 2	\N	2026-11-11 16:29:58.808
447357a4-ec37-4834-89ec-dc9618a38394	881930b1-ac6d-40e9-aed4-23b38a1530c6	SECTION_DELETE	Section	0c5ae183-de8f-46e1-9bae-7170cd1f4136	stage=2, MORNING, 3	\N	2026-11-11 16:30:00.697
18a1d549-403c-499c-9aec-63090e065c17	881930b1-ac6d-40e9-aed4-23b38a1530c6	UPDATE_STUDENT_COURSES	Student	b701252f-fa78-4543-b168-c3587646fa50	{"academicStatus":"REPEAT","courseCount":1,"notes":null}	\N	2026-11-11 16:32:42.477
b5bc2d07-b775-464c-ab7d-246df44ecf73	881930b1-ac6d-40e9-aed4-23b38a1530c6	UPDATE_STUDENT_COURSES	Student	7648f6c7-0f46-447b-b877-3f14ecb2cdea	{"academicStatus":"REPEAT","courseCount":4,"notes":null}	\N	2026-11-11 16:33:44.09
c47c8870-5d48-4fd5-8e0d-600327c4c043	881930b1-ac6d-40e9-aed4-23b38a1530c6	UPDATE_STUDENT_COURSES	Student	b35ec4e7-94a9-4bc0-9ff6-c7a00dbbf9ad	{"academicStatus":"REPEAT","courseCount":1,"notes":null}	\N	2026-11-11 16:35:19.239
f4f65d66-9127-48a6-b311-ca100ebc59bd	881930b1-ac6d-40e9-aed4-23b38a1530c6	UPDATE_STUDENT_COURSES	Student	95e8dcef-dac3-4521-8f2c-015406f55a76	{"academicStatus":"REPEAT","courseCount":3,"notes":null}	\N	2026-11-11 16:35:52.137
c1cb751e-4f81-49ac-9862-0332933f4bc5	881930b1-ac6d-40e9-aed4-23b38a1530c6	UPDATE_STUDENT_COURSES	Student	542d85a0-42ac-407b-a3ec-0e1baf64afca	{"academicStatus":"REPEAT","courseCount":1,"notes":null}	\N	2026-11-11 16:36:11.205
9c3ebe54-d8b2-4135-a9cc-9bfd975aea8e	881930b1-ac6d-40e9-aed4-23b38a1530c6	UPDATE_STUDENT_COURSES	Student	6a8a563c-f6b4-4901-a9b2-11d811a119b9	{"academicStatus":"REPEAT","courseCount":3,"notes":null}	\N	2026-11-11 16:36:37.645
913445d6-a0ee-47db-bc77-3d79d6b5fbbd	881930b1-ac6d-40e9-aed4-23b38a1530c6	UPDATE_STUDENT_COURSES	Student	dd51884a-dfe8-40ad-a14d-1d1a02900912	{"academicStatus":"REPEAT","courseCount":6,"notes":null}	\N	2026-11-11 16:37:06.223
4efe209a-f7d1-4450-bf08-498980a1d2b6	881930b1-ac6d-40e9-aed4-23b38a1530c6	UPDATE_STUDENT_COURSES	Student	5626a783-15bc-4f9e-9e92-e7aa26b29683	{"academicStatus":"REPEAT","courseCount":4,"notes":null}	\N	2026-11-11 16:37:46.174
9ee78e18-8438-4f72-a7d5-e2fca2333857	881930b1-ac6d-40e9-aed4-23b38a1530c6	UPDATE_STUDENT_COURSES	Student	57526353-e3cb-43c3-a9be-d4fdfc1d4b1e	{"academicStatus":"REPEAT","courseCount":4,"notes":null}	\N	2026-11-11 16:38:31.078
3ce1fef2-e037-40fc-95f4-86a01c4d8efe	881930b1-ac6d-40e9-aed4-23b38a1530c6	UPDATE_STUDENT_COURSES	Student	d4aaa83b-9ec1-4435-a52e-557c91fbfede	{"academicStatus":"REPEAT","courseCount":8,"notes":null}	\N	2026-11-11 16:38:50.291
0db1b8d0-34b2-4114-acd6-5ab79ddc8331	881930b1-ac6d-40e9-aed4-23b38a1530c6	UPDATE_STUDENT_COURSES	Student	bec44d33-9aa2-4745-afe6-fb6488590874	{"academicStatus":"REPEAT","courseCount":3,"notes":null}	\N	2026-11-11 16:39:43.341
e8a91181-d871-4238-907b-1896ff271752	881930b1-ac6d-40e9-aed4-23b38a1530c6	UPDATE_STUDENT_COURSES	Student	951fe6b5-c0ee-4f67-b56d-04e9dab757e1	{"academicStatus":"REPEAT","courseCount":4,"notes":null}	\N	2026-11-11 16:40:15.974
c1af486b-4676-4fde-b275-5ac73b93e971	881930b1-ac6d-40e9-aed4-23b38a1530c6	UPDATE_STUDENT_COURSES	Student	fc86659a-bf9b-4b0b-96b1-bef3d385c0b1	{"academicStatus":"REPEAT","courseCount":3,"notes":null}	\N	2026-11-11 16:40:44.501
e06b7eeb-ee6e-4bed-ae8c-936f733823ad	881930b1-ac6d-40e9-aed4-23b38a1530c6	UPDATE_STUDENT_COURSES	Student	2e33c729-e464-470e-8c1a-2a2d76c4adba	{"academicStatus":"REPEAT","courseCount":1,"notes":null}	\N	2026-11-11 16:40:56.989
8d8d5c39-5829-49ba-997d-e3bc08e89b48	881930b1-ac6d-40e9-aed4-23b38a1530c6	UPDATE_STUDENT_COURSES	Student	49e286c3-d440-4590-ba9d-604b1ca579ff	{"academicStatus":"REPEAT","courseCount":3,"notes":null}	\N	2026-11-11 16:41:21.901
0c05da06-99f0-4319-aacb-a5a080ecd0ef	881930b1-ac6d-40e9-aed4-23b38a1530c6	UPDATE_STUDENT_COURSES	Student	49e286c3-d440-4590-ba9d-604b1ca579ff	{"academicStatus":"REPEAT","courseCount":3,"notes":null}	\N	2026-11-11 16:41:30.388
d72de0ef-df1c-42f1-a499-939b15688a1f	881930b1-ac6d-40e9-aed4-23b38a1530c6	UPDATE_STUDENT_COURSES	Student	dd5f1434-c289-4193-bf43-a205467559a7	{"academicStatus":"REPEAT","courseCount":3,"notes":null}	\N	2026-11-11 16:41:53.541
3b99ea21-6603-4dd0-a78d-cb9a756d4f61	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_DELETE	Course	e3a7c4e5-6b61-405a-a68a-f582dc65f554	ARB201 - لغة عربية	\N	2026-11-11 17:05:45.164
d0c3e6e1-886c-467b-b78c-e16122a3facd	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_DELETE	Course	b6f74db6-3bec-415d-9b11-3988be5bb831	CHE201 - كيمياء سريرية 1	\N	2026-11-11 17:05:52.39
98e4538a-44ba-4641-902a-c2da9725093d	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_DELETE	Course	c139e318-718c-417d-a6e0-9d7eba06a953	HEM201 - امراض دم 1	\N	2026-11-11 17:05:57.87
ceac55ad-e695-4eff-9dae-479baaf0af01	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_DELETE	Course	f0a81bad-7a47-4d14-b744-f96e67f5eaa9	IMM201 - علم المناعة	\N	2026-11-11 17:06:01.702
58f520a4-a957-4ee9-a994-aaf54a3bdc61	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_DELETE	Course	186b43e7-fdc5-403b-905c-b75573cb2d1f	MIC201 - احياء مجهرية	\N	2026-11-11 17:06:03.672
c51cf842-383c-4181-ab6a-43535a2e788d	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_DELETE	Course	ff992825-ab5e-4a9f-922d-8fb56523fc2c	PAR201 - طفيليات ابتدائية	\N	2026-11-11 17:06:05.324
03c90a01-6b18-4294-a6e7-edcea45d7914	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_DELETE	Course	7bd28510-162f-48f7-bd21-991aa37091e4	VIR201 - فايروسات	\N	2026-11-11 17:06:09.293
af5068e3-243d-4661-ae75-fe3ef88a5a33	881930b1-ac6d-40e9-aed4-23b38a1530c6	COURSE_DELETE	Course	502c7be5-7460-402c-83f9-45303ac9db00	ETH201 - سلوك مهني	\N	2026-11-11 17:06:12.753
\.


--
-- Data for Name: Course; Type: TABLE DATA; Schema: public; Owner: attendance_user
--

COPY public."Course" (id, code, name, stage, description, "createdAt", "updatedAt", type) FROM stdin;
181f8904-c74b-4552-bfa2-34320917743b	HEM	أمراض الدم 1	2	\N	2026-11-11 14:01:29.702	2026-11-11 14:23:52.888	BOTH
11e80dca-9baa-4ca6-8383-b9c45df626ba	IMM	علم المناعة	2	\N	2026-11-11 14:02:06.815	2026-11-11 14:23:55.517	BOTH
349a1970-6ada-4479-b97d-15fb1cacddbb	RAR	الطفيليات الابتدائية	2	\N	2026-11-11 14:01:50.28	2026-11-11 14:24:06.258	BOTH
a0c103a8-cb31-4cb9-af84-10cd8cdf3c4b	VIR	الفايروسات	2	\N	2026-11-11 14:02:22.63	2026-11-11 14:24:09.148	BOTH
3e1b1e09-3d59-4a0c-b9e7-5dd614cf9f25	AR	اللغة العربية	2	\N	2026-11-11 14:02:27.491	2026-11-11 14:24:21.616	THEORETICAL
2622aa44-a0fe-49d1-969b-4a485d62296a	CC	كيمياء سريرية 1	2	\N	2026-11-11 14:01:39.111	2026-11-11 14:24:57.121	BOTH
1441e34d-f326-40cf-9d75-0fd96ac3da2f	MIC	الأحياء المجهرية	2	\N	2026-11-11 14:01:59.073	2026-11-11 14:29:35.213	BOTH
e16de310-b49a-480e-8d63-b63f15dc3ef7	PE	السلوك المهني	2	\N	2026-11-11 14:02:15.656	2026-11-11 14:29:46.88	THEORETICAL
\.


--
-- Data for Name: Lecture; Type: TABLE DATA; Schema: public; Owner: attendance_user
--

COPY public."Lecture" (id, name, "studyPeriod", section, status, "qrToken", "qrExpiresAt", "startedAt", "closedAt", "createdAt", "createdByUserId", "conductedByUserId", "courseId", "deletedAt", "sectionId") FROM stdin;
\.


--
-- Data for Name: LectureSection; Type: TABLE DATA; Schema: public; Owner: attendance_user
--

COPY public."LectureSection" ("lectureId", "sectionId") FROM stdin;
\.


--
-- Data for Name: Section; Type: TABLE DATA; Schema: public; Owner: attendance_user
--

COPY public."Section" (id, "studyPeriod", name, label, "createdAt", stage, "updatedAt") FROM stdin;
96fd4802-c311-4e15-8670-526d282ea6d6	EVENING	2	الشعبة الثانية	2026-11-03 18:49:18.453	2	2026-11-06 21:16:07.579
567ccb95-62b5-446f-848b-8b991ce5b18c	EVENING	3	الشعبة الثالثة	2026-11-03 18:49:18.464	2	2026-11-06 21:16:07.579
01e1b86f-19ff-4e51-a236-e30b97f47689	EVENING	4	الشعبة الرابعة	2026-11-03 18:49:18.475	2	2026-11-06 21:16:07.579
fbfdaf04-5337-4a45-b884-34ee187902b1	EVENING	5	الشعبة الخامسة	2026-11-03 18:49:18.485	2	2026-11-06 21:16:07.579
43897e7f-b159-4093-beac-4a0cc42d5782	EVENING	6	الشعبة السادسة	2026-11-03 18:49:18.497	2	2026-11-06 21:16:07.579
a47c3505-eca8-478b-9df3-91e5504811fa	EVENING	7	الشعبة السابعة	2026-11-03 18:49:18.507	2	2026-11-06 21:16:07.579
b35abf9d-5911-405d-85f1-e2700c50cf1d	EVENING	8	الشعبة الثامنة	2026-11-03 18:49:18.516	2	2026-11-06 21:16:07.579
bd2707b8-2234-4cfb-8847-21b460a5046f	EVENING	1	الشعبة الأولى	2026-11-03 18:49:18.443	2	2026-11-06 18:24:20.758
\.


--
-- Data for Name: StaffSession; Type: TABLE DATA; Schema: public; Owner: attendance_user
--

COPY public."StaffSession" (id, "userId", "tokenHash", "expiresAt", "revokedAt", "ipAddress", "userAgent", "createdAt", "lastUsedAt") FROM stdin;
950a466e-4c93-4671-9ff4-b7ce7b9e3345	881930b1-ac6d-40e9-aed4-23b38a1530c6	4197057e7aa81113862cb6ed599c1c0ec59fc805b15509965bbc76a529d59d07	2026-11-06 22:29:35.458	2026-11-06 10:32:08.79	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36	2026-11-06 10:29:35.459	\N
5609471c-ebd9-420a-890f-e26474de87fd	881930b1-ac6d-40e9-aed4-23b38a1530c6	7d5f0b5f95fb48c5b24b8ae4182d35a97b741c9fb9693fb3b3c1abcf19d0eef7	2026-11-07 01:20:19.56	2026-11-06 18:17:36.119	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36	2026-11-06 13:20:19.562	\N
13ecd9df-95b6-4eb9-9e3c-21e27396e83e	881930b1-ac6d-40e9-aed4-23b38a1530c6	dfcfba70b2b63f61806f1f7e5bfeb262f3da34393d0a91fd38e0b8537801fe56	2026-11-07 06:18:40.015	2026-11-06 18:20:18.456	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36	2026-11-06 18:18:40.016	\N
c295cda4-c069-490c-bb5b-42cbbdbf2908	881930b1-ac6d-40e9-aed4-23b38a1530c6	d78ab63ee384bbefb5c2cf48aa19f4269aaad3a1964c4a2cedfc43f232716932	2026-11-07 06:21:58.584	2026-11-06 18:23:23.056	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36	2026-11-06 18:21:58.586	\N
34449be8-e80c-48d2-ab63-10c5e12b03bf	881930b1-ac6d-40e9-aed4-23b38a1530c6	63437bf2b9c0cc04442f60c48a1d14f249196842febfc27a916e0c4ebdb0267e	2026-11-07 06:24:03.084	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36	2026-11-06 18:24:03.086	\N
f904f84b-4536-4da0-86b2-6974c74ae81f	881930b1-ac6d-40e9-aed4-23b38a1530c6	dbec400b92477c3d2b73e9068064ed1bb68add08c3c90cbc7f287a07714376cc	2026-11-08 04:48:37.155	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36	2026-11-07 16:48:37.158	\N
140d6b2d-0b41-4759-9b86-f8b566c07fbe	881930b1-ac6d-40e9-aed4-23b38a1530c6	4781c9aac2e0dce9cb31852dc21f3eac3011bc0121b40c20307eb4c22898b4bb	2026-11-10 00:10:08.86	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36	2026-11-09 12:10:08.862	\N
680e8166-072d-4b10-a245-5a66f729498f	881930b1-ac6d-40e9-aed4-23b38a1530c6	32805a6898ee5171969d6e0f92cc755d0eba35d58d8737fd1bb01911c27b59de	2026-11-10 00:10:11.823	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36	2026-11-09 12:10:11.825	\N
2318dd74-0605-44e0-9426-d0c464e7a613	881930b1-ac6d-40e9-aed4-23b38a1530c6	496eacd28c1e8f3a3391edb6c2c9134c822f33fed47e92bdad7ae33624c9b9d5	2026-11-11 18:54:42.661	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36	2026-11-11 06:54:42.663	\N
ab84a006-44fe-4a31-958e-2433cd35aa2e	881930b1-ac6d-40e9-aed4-23b38a1530c6	2c591cb50edee05f6098b008aa30fdd6f5173a2e1f98cc890d1a0dcf440cc209	2026-11-11 18:54:46.015	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36	2026-11-11 06:54:46.017	\N
\.


--
-- Data for Name: StaffUser; Type: TABLE DATA; Schema: public; Owner: attendance_user
--

COPY public."StaffUser" (id, "staffId", "fullName", role, "passwordHash", "isActive", "failedLoginCount", "lockedUntil", "lastLoginAt", "createdAt", "updatedAt") FROM stdin;
881930b1-ac6d-40e9-aed4-23b38a1530c6	mohammed	محمد	SYSTEM_OWNER	$2b$12$AHOyQ.d61Jv.XzKqDdDSeupJeUwVI/a2UwZqFH8nsUV7.MOQ5MEcm	t	0	\N	2026-11-11 06:54:46.019	2026-11-06 10:07:22.378	2026-11-11 17:29:20.438
6ec9c995-64b3-413e-bab8-9533d21d126f	aqeel	عقيل سلمان	LECTURER	$2b$12$oc3YLLKxRtfZkRqhOeHU1OlHGdHIMRmxaQ0PkfbDMGuHHQlMp/Zse	t	0	\N	\N	2026-11-11 14:41:48.721	2026-11-11 14:41:48.721
ecbfc25f-cc04-45b5-9f21-74665f4f10f4	zainab	د. زينب عبد الفتاح	LECTURER	$2b$12$oc3YLLKxRtfZkRqhOeHU1OlHGdHIMRmxaQ0PkfbDMGuHHQlMp/Zse	t	0	\N	\N	2026-11-11 14:41:48.726	2026-11-11 14:41:48.726
8a3efc47-e900-49ef-9caf-8e3fa27ac8b7	jaafar	د. جعفر حلف	LECTURER	$2b$12$oc3YLLKxRtfZkRqhOeHU1OlHGdHIMRmxaQ0PkfbDMGuHHQlMp/Zse	t	0	\N	\N	2026-11-11 14:41:48.727	2026-11-11 14:41:48.727
9b09a778-3728-46e1-8a8b-6f5a45f25030	hussein	حسين يوسف	LECTURER	$2b$12$oc3YLLKxRtfZkRqhOeHU1OlHGdHIMRmxaQ0PkfbDMGuHHQlMp/Zse	t	0	\N	\N	2026-11-11 14:41:48.729	2026-11-11 14:41:48.729
49def886-14ca-4d26-b1d6-ab71ebbb56fa	hadeel	هديل صالح	LECTURER	$2b$12$oc3YLLKxRtfZkRqhOeHU1OlHGdHIMRmxaQ0PkfbDMGuHHQlMp/Zse	t	0	\N	\N	2026-11-11 14:41:48.731	2026-11-11 14:41:48.731
1d22bbc5-b02a-4d11-8a95-c7c32f90cf10	israa	إسراء جواد	LECTURER	$2b$12$oc3YLLKxRtfZkRqhOeHU1OlHGdHIMRmxaQ0PkfbDMGuHHQlMp/Zse	t	0	\N	\N	2026-11-11 14:41:48.732	2026-11-11 14:41:48.732
af8be5a0-7196-40ae-a79d-25fd9dcdca11	balqis	د. بلقيس عبد علي	LECTURER	$2b$12$oc3YLLKxRtfZkRqhOeHU1OlHGdHIMRmxaQ0PkfbDMGuHHQlMp/Zse	t	0	\N	\N	2026-11-11 14:41:48.733	2026-11-11 14:41:48.733
3c9527a0-35b6-4456-99f0-c251e773faef	amal	د. آمال صاحب	LECTURER	$2b$12$oc3YLLKxRtfZkRqhOeHU1OlHGdHIMRmxaQ0PkfbDMGuHHQlMp/Zse	t	0	\N	\N	2026-11-11 14:41:48.734	2026-11-11 14:41:48.734
4cf6e382-e52d-48e2-816a-e1cbb0b4b772	salem.hussein	د. سالم حسين	LECTURER	$2b$12$oc3YLLKxRtfZkRqhOeHU1OlHGdHIMRmxaQ0PkfbDMGuHHQlMp/Zse	t	0	\N	\N	2026-11-11 14:41:48.737	2026-11-11 14:41:48.737
8521cfc0-8d24-4ab5-8674-7857195d34e1	ruaa	د. رؤى نوري	LECTURER	$2b$12$oc3YLLKxRtfZkRqhOeHU1OlHGdHIMRmxaQ0PkfbDMGuHHQlMp/Zse	t	0	\N	\N	2026-11-11 14:41:48.738	2026-11-11 14:41:48.738
efdf9c07-e756-4945-9a45-af0b51db84dd	zahraa.qais	زهراء قيس	LECTURER	$2b$12$oc3YLLKxRtfZkRqhOeHU1OlHGdHIMRmxaQ0PkfbDMGuHHQlMp/Zse	t	0	\N	\N	2026-11-11 14:41:48.739	2026-11-11 14:41:48.739
725ad425-541f-41e5-827b-1e4c4b243990	mohammed.riyadh	محمد رياض	LECTURER	$2b$12$oc3YLLKxRtfZkRqhOeHU1OlHGdHIMRmxaQ0PkfbDMGuHHQlMp/Zse	t	0	\N	\N	2026-11-11 14:41:48.74	2026-11-11 14:41:48.74
c78d3988-def2-4ee4-a72a-3410d89cdf79	mustafa	مصطفى حسن	LECTURER	$2b$12$oc3YLLKxRtfZkRqhOeHU1OlHGdHIMRmxaQ0PkfbDMGuHHQlMp/Zse	t	0	\N	\N	2026-11-11 14:41:48.742	2026-11-11 14:41:48.742
c941e1b1-0fab-4d3d-ba3a-9915a43c1ff8	salem.fahim	سالم فاهم	LECTURER	$2b$12$oc3YLLKxRtfZkRqhOeHU1OlHGdHIMRmxaQ0PkfbDMGuHHQlMp/Zse	t	0	\N	\N	2026-11-11 14:41:48.744	2026-11-11 14:41:48.744
c532404e-cd7f-4b37-bb91-79f4a34644d9	zahraa.ahmed	زهراء أحمد ميري	LECTURER	$2b$12$oc3YLLKxRtfZkRqhOeHU1OlHGdHIMRmxaQ0PkfbDMGuHHQlMp/Zse	t	0	\N	\N	2026-11-11 14:41:48.746	2026-11-11 14:41:48.746
fcb33c2d-e4fb-489e-ac71-a9f8f4d90ca1	asia	آسيا جواد	LECTURER	$2b$12$oc3YLLKxRtfZkRqhOeHU1OlHGdHIMRmxaQ0PkfbDMGuHHQlMp/Zse	t	0	\N	\N	2026-11-11 14:41:48.747	2026-11-11 14:41:48.747
fa7e9ebd-0f47-4d1d-9664-3becb064332a	muhannad	مهند عبد مسلم	LECTURER	$2b$12$oc3YLLKxRtfZkRqhOeHU1OlHGdHIMRmxaQ0PkfbDMGuHHQlMp/Zse	t	0	\N	\N	2026-11-11 14:41:48.748	2026-11-11 14:41:48.748
d6b92e20-1858-49bc-87ba-5eb59dffd987	mohammed.hadi	محمد هادي	LECTURER	$2b$12$oc3YLLKxRtfZkRqhOeHU1OlHGdHIMRmxaQ0PkfbDMGuHHQlMp/Zse	t	0	\N	\N	2026-11-11 14:41:48.749	2026-11-11 14:41:48.749
34e078ac-4ad3-4801-82f7-0816cb259c36	haider	حيدر علي	LECTURER	$2b$12$oc3YLLKxRtfZkRqhOeHU1OlHGdHIMRmxaQ0PkfbDMGuHHQlMp/Zse	t	0	\N	\N	2026-11-11 14:41:48.75	2026-11-11 14:41:48.75
613b34de-bac7-4603-b468-ccfe9cb4537b	nouran	نوران علي	LECTURER	$2b$12$oc3YLLKxRtfZkRqhOeHU1OlHGdHIMRmxaQ0PkfbDMGuHHQlMp/Zse	t	0	\N	\N	2026-11-11 14:41:48.751	2026-11-11 14:41:48.751
74f44ea8-4e62-4c11-89b1-d772f05d1695	zahraa.rasool	زهراء رسول	LECTURER	$2b$12$oc3YLLKxRtfZkRqhOeHU1OlHGdHIMRmxaQ0PkfbDMGuHHQlMp/Zse	t	0	\N	\N	2026-11-11 14:41:48.753	2026-11-11 14:41:48.753
ab94b809-d363-491a-bdce-9c3a770ab397	ali	علي مهدي	LECTURER	$2b$12$oc3YLLKxRtfZkRqhOeHU1OlHGdHIMRmxaQ0PkfbDMGuHHQlMp/Zse	t	0	\N	\N	2026-11-11 14:41:48.754	2026-11-11 14:41:48.754
ddadd424-42b7-4f53-ad8a-84345c3bdaec	aziz	عزيز مهنا خلف	LECTURER	$2b$12$oc3YLLKxRtfZkRqhOeHU1OlHGdHIMRmxaQ0PkfbDMGuHHQlMp/Zse	t	0	\N	\N	2026-11-11 14:41:48.755	2026-11-11 14:41:48.755
eab7a0ae-b2cd-4090-bbff-d19d1ea8dae2	qasim	قاسم زغير	LECTURER	$2b$12$oc3YLLKxRtfZkRqhOeHU1OlHGdHIMRmxaQ0PkfbDMGuHHQlMp/Zse	t	0	\N	\N	2026-11-11 14:41:48.756	2026-11-11 14:41:48.756
d98123a9-8054-496f-b3c7-6d280309ad14	ahmed	أحمد حسين	LECTURER	$2b$12$oc3YLLKxRtfZkRqhOeHU1OlHGdHIMRmxaQ0PkfbDMGuHHQlMp/Zse	t	0	\N	\N	2026-11-11 14:41:48.758	2026-11-11 14:41:48.758
\.


--
-- Data for Name: Student; Type: TABLE DATA; Schema: public; Owner: attendance_user
--

COPY public."Student" (id, "orderIndex", "studentCode", name, "studyPeriod", section, "presentCount", "absentCount", "totalSessions", rate, "createdAt", "updatedAt", stage, "sectionId", "deletedAt") FROM stdin;
27ea5086-ccbb-4512-aaad-ef62e8330165	1	S2-0001	ابرار احمد حسين كعيم	EVENING	1	0	0	0	0	2026-11-11 13:47:03.946	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
d699ee56-b396-4b7f-bddf-61897dede2dd	2	S2-0002	ابرار مشرق محمد روضان	EVENING	1	0	0	0	0	2026-11-11 13:47:03.958	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
c9639728-b9a7-448a-81c6-c39d41e49d35	3	S2-0003	احسان اسعد حمادي سليمان	EVENING	1	0	0	0	0	2026-11-11 13:47:03.975	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
689d3015-1d30-4720-b65b-07cf1bca1c54	4	S2-0004	احلام عيدان عباس فاضل	EVENING	1	0	0	0	0	2026-11-11 13:47:03.978	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
6aeb1c4c-3292-4795-9fbc-551fb5b3b4e2	5	S2-0005	احمد حسن هادي عباس	EVENING	1	0	0	0	0	2026-11-11 13:47:03.981	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
ab135a17-ff78-4ade-b4c3-e0c6b385bc7b	6	S2-0006	احمد حسين سلمان دحام	EVENING	1	0	0	0	0	2026-11-11 13:47:03.984	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
6b0cda60-acb4-4df4-bd56-32aac11f20a0	7	S2-0007	احمد مازن جواد ضاحي	EVENING	1	0	0	0	0	2026-11-11 13:47:03.989	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
e0ca59d1-df56-4f8d-b324-ae6a2f606e1d	8	S2-0008	احمد نزار صوين عبادي	EVENING	1	0	0	0	0	2026-11-11 13:47:03.992	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
2ef82f0d-53be-4e25-85f7-06a318c226e0	9	S2-0009	احمد هاشم فاضل جاسم	EVENING	1	0	0	0	0	2026-11-11 13:47:03.994	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
174d537a-794d-42c3-b58f-90fe79f9377a	10	S2-0010	احمد يونس ناهي ساهي	EVENING	1	0	0	0	0	2026-11-11 13:47:03.996	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
96711f4d-2aef-4155-8c73-71f92db67666	11	S2-0011	اريج عبد العباس ناجي منسي	EVENING	1	0	0	0	0	2026-11-11 13:47:03.999	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
1c25efc6-b368-4e9b-bd8b-5f9c35ab3fea	12	S2-0012	اسامة حيدر صبيح عباس	EVENING	1	0	0	0	0	2026-11-11 13:47:04.001	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
b701252f-fa78-4543-b168-c3587646fa50	13	S2-0013	استبرق حسن علي تالي	EVENING	1	0	0	0	0	2026-11-11 13:47:04.004	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
5428c90e-2965-4314-8b7e-d8fa1b115a11	14	S2-0014	استبرق عباس بزون مشير	EVENING	1	0	0	0	0	2026-11-11 13:47:04.006	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
388486bb-3626-435d-8592-70447e629004	15	S2-0015	اسراء حامد عمران حسين	EVENING	1	0	0	0	0	2026-11-11 13:47:04.008	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
62cf95e6-c8ee-493f-9a30-edd816d28965	16	S2-0016	اسراء فاضل حمزه سوادي	EVENING	1	0	0	0	0	2026-11-11 13:47:04.011	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
4da2d449-05c0-4ad2-a95c-91f0f4fe806d	17	S2-0017	اسماء جعفر مال الله منسي	EVENING	1	0	0	0	0	2026-11-11 13:47:04.014	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
72b8ac2b-520d-41ed-929f-bc8e14e7c4d1	18	S2-0018	اسماء فاضل علي حسن	EVENING	1	0	0	0	0	2026-11-11 13:47:04.016	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
94579fd0-5149-4925-92a7-3aac83913062	19	S2-0019	اشرف محسن فنجان مرعيد	EVENING	1	0	0	0	0	2026-11-11 13:47:04.019	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
6ea84971-39db-4cf7-8445-b369e5992e72	20	S2-0020	افراح نوري جابر حسان	EVENING	1	0	0	0	0	2026-11-11 13:47:04.021	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
011c44d9-5695-46a7-9d11-09e41fed0277	21	S2-0021	الحسين علي رضا غازي	EVENING	1	0	0	0	0	2026-11-11 13:47:04.024	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
d58ca823-758c-4101-b87d-c82830213d90	22	S2-0022	الحوراء علي حسين عليوي	EVENING	1	0	0	0	0	2026-11-11 13:47:04.026	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
0e93f95d-5c04-40d4-94df-391fa8a996c4	23	S2-0023	امال خضر داخل عبيد	EVENING	1	0	0	0	0	2026-11-11 13:47:04.028	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
c2ac513a-5a25-4821-807c-b6a1f99a8a64	24	S2-0024	امير احمد صالح عبيد	EVENING	1	0	0	0	0	2026-11-11 13:47:04.031	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
ce92274e-7960-45f3-bfe4-fc5bb3b2e20a	25	S2-0025	امير حامد خضير عبيس	EVENING	1	0	0	0	0	2026-11-11 13:47:04.033	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
feb0a3eb-32a9-41d3-9f16-db2de0360c0e	26	S2-0026	امير علي حسين ناصر	EVENING	1	0	0	0	0	2026-11-11 13:47:04.035	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
350041ef-fff9-4fd8-ac1c-f56d6184dff2	27	S2-0027	امير كاظم تركي عوده	EVENING	1	0	0	0	0	2026-11-11 13:47:04.038	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
7900dedd-8499-416d-8ad6-0ac8027e4195	28	S2-0028	ايات جاسم منشد جابر	EVENING	1	0	0	0	0	2026-11-11 13:47:04.04	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
6d87e4ea-88d0-4c95-aad0-9b5aa71ed315	29	S2-0029	ايات حسين حميد منسي	EVENING	1	0	0	0	0	2026-11-11 13:47:04.042	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
716fc3c8-22db-449e-818e-acd82807a555	30	S2-0030	ايات صباح شعيبث نايف	EVENING	1	0	0	0	0	2026-11-11 13:47:04.046	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
9eb2a2e7-e59f-4c32-a0ce-f12de2905aff	31	S2-0031	ايات طالب صاحب حسن	EVENING	1	0	0	0	0	2026-11-11 13:47:04.048	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
e76abfc6-e35b-436b-abaa-4d8dc1dc8ba4	32	S2-0032	ايات طالب عباس عبد السادة	EVENING	1	0	0	0	0	2026-11-11 13:47:04.05	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
2b810c29-48cc-475f-bf82-5f310d3ec470	33	S2-0033	ايمان قصي علي عبد الامير	EVENING	1	0	0	0	0	2026-11-11 13:47:04.053	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
664d644d-c9ca-4c57-b3e7-b8756c78b6a8	34	S2-0034	ايناس عباس حمزه وساف	EVENING	1	0	0	0	0	2026-11-11 13:47:04.056	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
16527729-d286-410d-9c98-946db8fccf20	35	S2-0035	ايه رشيد حميد عبد	EVENING	1	0	0	0	0	2026-11-11 13:47:04.058	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
7ae76a5c-fa81-4f21-b41e-ad4caebba2dd	36	S2-0036	ايه صادق عبد الحسين طاهر	EVENING	1	0	0	0	0	2026-11-11 13:47:04.061	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
42d33670-6b86-4656-8faa-a4c6561fd03b	37	S2-0037	باقر حسن رحيم عيدان	EVENING	1	0	0	0	0	2026-11-11 13:47:04.063	2026-11-11 13:55:51.939	2	bd2707b8-2234-4cfb-8847-21b460a5046f	\N
9e3e40a1-5e48-415a-801f-562e47af85cc	38	S2-0038	باقر قاسم عبد الكاظم عباس	EVENING	2	0	0	0	0	2026-11-11 13:47:04.065	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
c3a94230-0402-4088-83d2-96d445bd96b2	39	S2-0039	بتول ناظم شاطي حمد	EVENING	2	0	0	0	0	2026-11-11 13:47:04.068	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
6ca6e479-d168-4864-8461-653fad82732f	40	S2-0040	براء قاسم عبد الامير مزهر	EVENING	2	0	0	0	0	2026-11-11 13:47:04.07	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
bd754cd5-71fd-4b19-93c5-1558d1102660	41	S2-0041	براق فاضل عباس علوان	EVENING	2	0	0	0	0	2026-11-11 13:47:04.073	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
c78eea94-395e-4ca3-b0ed-3130952d450c	42	S2-0042	بركات خضر داخل عبيد	EVENING	2	0	0	0	0	2026-11-11 13:47:04.075	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
a8d59d50-976e-4d0f-a74c-1908381c30e6	43	S2-0043	بنين باسم محمد كاظم	EVENING	2	0	0	0	0	2026-11-11 13:47:04.077	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
3469adb9-a385-44d9-bf72-c874100fdb4e	44	S2-0044	بنين حمد سالم عوده	EVENING	2	0	0	0	0	2026-11-11 13:47:04.08	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
c0dcaeec-eb97-4b41-bd4f-d2ae9e8668cf	45	S2-0045	بنين سلمان حسين عسل	EVENING	2	0	0	0	0	2026-11-11 13:47:04.083	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
7cac37a1-a056-4a63-876c-a67e76d602f0	46	S2-0046	بنين عبد شنين شعلان عاجل	EVENING	2	0	0	0	0	2026-11-11 13:47:04.085	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
58cccab8-b0cb-448f-ad88-46929cd69259	47	S2-0047	بنين عكوش شهيد جياد	EVENING	2	0	0	0	0	2026-11-11 13:47:04.087	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
73fbcb44-49c8-4aeb-8f1f-ee2ab82b49e1	48	S2-0048	بنين عواد حسون داود	EVENING	2	0	0	0	0	2026-11-11 13:47:04.09	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
77b65b90-ead1-413f-9184-80e98ccd519b	49	S2-0049	بنين قائد عبد علي	EVENING	2	0	0	0	0	2026-11-11 13:47:04.092	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
59fdea10-0920-4681-b7ae-83614dcb3e6b	50	S2-0050	تبارك حسن كاظم عبد عكاب	EVENING	2	0	0	0	0	2026-11-11 13:47:04.094	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
d7d0bcb1-41ea-4686-8f5e-cabf9ba90355	51	S2-0051	تبارك حيدر حسين هاشم	EVENING	2	0	0	0	0	2026-11-11 13:47:04.096	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
e1b4cddc-340a-4cb7-bc1c-6e3d668c6a01	52	S2-0052	تبارك ضياء حسين عبود	EVENING	2	0	0	0	0	2026-11-11 13:47:04.099	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
07869a5c-955c-4fb0-8bfe-e2ad8954f0d5	53	S2-0053	تقى حيدر دحام حميد	EVENING	2	0	0	0	0	2026-11-11 13:47:04.101	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
d6f69e90-9aa9-4bb7-b75f-6007a83a2f51	54	S2-0054	حاتم عبد الله حاتم مطلب	EVENING	2	0	0	0	0	2026-11-11 13:47:04.104	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
efb72d5c-766f-45c2-88b7-947d87350e6d	55	S2-0055	حسن جاسم فليح حسن	EVENING	2	0	0	0	0	2026-11-11 13:47:04.106	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
7648f6c7-0f46-447b-b877-3f14ecb2cdea	56	S2-0056	حسن علي حسين مغير	EVENING	2	0	0	0	0	2026-11-11 13:47:04.108	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
210ef267-62ca-41f1-9848-c055b4b1a396	57	S2-0057	حسن ماهر ناجح مبدر	EVENING	2	0	0	0	0	2026-11-11 13:47:04.111	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
1c0f3be3-345e-4505-aab9-575357d745b0	58	S2-0058	حسنين علي صالح عبد الرسول	EVENING	2	0	0	0	0	2026-11-11 13:47:04.115	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
21a2bd30-744a-4304-9152-1366ed3bff4b	59	S2-0059	حسين جعفر حسن علي	EVENING	2	0	0	0	0	2026-11-11 13:47:04.122	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
b35ec4e7-94a9-4bc0-9ff6-c7a00dbbf9ad	60	S2-0060	حسين خضير عباس حسون	EVENING	2	0	0	0	0	2026-11-11 13:47:04.126	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
468f3b8e-803d-4acf-9a68-6a7678684379	61	S2-0061	حسين ستار جبار كاظم	EVENING	2	0	0	0	0	2026-11-11 13:47:04.131	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
a4b935e1-bc84-4baf-98f9-b0e6bf547d70	62	S2-0062	حسين عباس عبد الحسين سكر	EVENING	2	0	0	0	0	2026-11-11 13:47:04.133	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
842e0a09-3430-485e-a22f-dea16f8133f1	63	S2-0063	حسين علي فاضل عطيه	EVENING	2	0	0	0	0	2026-11-11 13:47:04.137	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
5cafefcd-09eb-4684-9293-c6e7a0d89330	64	S2-0064	حسين علي كاظم عنيد	EVENING	2	0	0	0	0	2026-11-11 13:47:04.14	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
1d17a3d6-467e-488c-8023-c184913dbd2b	65	S2-0065	حسين ماجد كاظم شياع	EVENING	2	0	0	0	0	2026-11-11 13:47:04.142	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
9d05386a-0fb8-4336-88f5-f2f4860d3890	66	S2-0066	حسين منصور مشعل مطلك	EVENING	2	0	0	0	0	2026-11-11 13:47:04.146	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
95e8dcef-dac3-4521-8f2c-015406f55a76	67	S2-0067	حمد امير حمد ظاهر	EVENING	2	0	0	0	0	2026-11-11 13:47:04.15	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
42f17106-f5fa-4d13-b8be-de5ed9aebb7c	68	S2-0068	حنين حيدر خوان حسين	EVENING	2	0	0	0	0	2026-11-11 13:47:04.154	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
a586490a-006d-4382-97e1-6f8ae7fa99a6	69	S2-0069	حنين كاظم درويش جار الله	EVENING	2	0	0	0	0	2026-11-11 13:47:04.158	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
24c4ce8a-13e4-4565-aa6a-399048983f26	70	S2-0070	حوراء احمد عطيه كاظم	EVENING	2	0	0	0	0	2026-11-11 13:47:04.162	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
0cdcc785-c7d0-4173-a42d-7e5b6dcb1211	71	S2-0071	حوراء باسم فخري عباده	EVENING	2	0	0	0	0	2026-11-11 13:47:04.165	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
0a546f08-8ce0-43d7-ad70-8312693a576c	72	S2-0072	حوراء رياض كاظم جويد	EVENING	2	0	0	0	0	2026-11-11 13:47:04.169	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
07679a5d-f2f5-439a-9fdb-7cf630af6946	73	S2-0073	حوراء علي جواد كاظم	EVENING	2	0	0	0	0	2026-11-11 13:47:04.172	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
0028374d-ac28-4b1a-a26d-f83e28b4913e	74	S2-0074	حوراء علي سالم عباس	EVENING	2	0	0	0	0	2026-11-11 13:47:04.175	2026-11-11 13:55:51.939	2	96fd4802-c311-4e15-8670-526d282ea6d6	\N
908efc85-d759-4e4a-87ed-21045cf969df	75	S2-0075	حوراء هيثم جبار عبد الرحيم	EVENING	3	0	0	0	0	2026-11-11 13:47:04.178	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
44fbfb6d-6aab-43fe-b1d9-7277eaf91710	76	S2-0076	حوراء ياس عبد الجبار	EVENING	3	0	0	0	0	2026-11-11 13:47:04.183	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
63ebc2ff-4d13-494d-a176-36b60882164e	77	S2-0077	حيدر كاظم جابر حمزه	EVENING	3	0	0	0	0	2026-11-11 13:47:04.187	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
b0cdb5d9-33a8-4f49-a849-3d3b351d2ce2	78	S2-0078	دعاء احمد حسن محمد	EVENING	3	0	0	0	0	2026-11-11 13:47:04.191	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
ae6f7b38-3cb4-4c3f-a348-173736febf3d	79	S2-0079	دعاء احمد وهيب جوده	EVENING	3	0	0	0	0	2026-11-11 13:47:04.2	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
87e0a025-dd8b-4a63-bd47-c5cb6dc1fafe	80	S2-0080	دعاء شدهان لاوي محمد	EVENING	3	0	0	0	0	2026-11-11 13:47:04.204	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
f05b8501-1c56-44f7-aa91-a3e323ef552a	81	S2-0081	دموع جميل جاسم محمد	EVENING	3	0	0	0	0	2026-11-11 13:47:04.209	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
bda1b017-79e9-4c1e-85b6-bbbe3844748e	82	S2-0082	راهي والي علي ضيدان	EVENING	3	0	0	0	0	2026-11-11 13:47:04.214	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
6f39eecf-72ad-4b56-91eb-6ea3de4772c0	83	S2-0083	رحاب عودة محمود موسى	EVENING	3	0	0	0	0	2026-11-11 13:47:04.217	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
363138c3-7a4a-42d2-8a57-5e6718856869	84	S2-0084	رسل عدي محمد عباس	EVENING	3	0	0	0	0	2026-11-11 13:47:04.222	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
04f1c93c-00fd-47ea-ae7a-7f001ac9c48e	85	S2-0085	رسل علاء حسين متعب	EVENING	3	0	0	0	0	2026-11-11 13:47:04.226	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
7112a83d-3dce-400f-bb1a-22330afabb31	86	S2-0086	رسل علي عوده محمد	EVENING	3	0	0	0	0	2026-11-11 13:47:04.231	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
02e51aa3-75bd-4e8d-9e29-287d60cfd695	87	S2-0087	رسل عماد جاسم جابر	EVENING	3	0	0	0	0	2026-11-11 13:47:04.235	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
a8ed3fb3-0a9c-4fa0-8a4e-97a1d9501cef	88	S2-0088	رفل وسام مصطاف جاسم	EVENING	3	0	0	0	0	2026-11-11 13:47:04.241	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
3ef0114e-35b8-43f7-ab3b-4d053fd6a6c7	89	S2-0089	رقيه حسين غالب كاظم	EVENING	3	0	0	0	0	2026-11-11 13:47:04.243	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
8bfa5dd9-9a1f-4a56-8a8a-5c7bb24974f0	90	S2-0090	رقيه رسول عكله راشد	EVENING	3	0	0	0	0	2026-11-11 13:47:04.246	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
aab234bc-daae-49d0-a321-3657f8f0bbf3	91	S2-0091	رقيه صافي كاظم زعلان	EVENING	3	0	0	0	0	2026-11-11 13:47:04.249	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
61bb7adf-78fa-4ab6-9bf2-f63c255db985	92	S2-0092	رقيه عامر سعدون عبد الكريم	EVENING	3	0	0	0	0	2026-11-11 13:47:04.252	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
72e3a7f1-7af1-4c5e-80b0-358694b328c7	93	S2-0093	رقيه قاسم شاكر نعمه	EVENING	3	0	0	0	0	2026-11-11 13:47:04.256	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
be1c6741-fa39-4539-afd6-ea85bf4b1220	94	S2-0094	رقيه مجبل حسين فرحان	EVENING	3	0	0	0	0	2026-11-11 13:47:04.258	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
e7c20b37-8b50-4122-ac96-ba2ea89d8cfc	95	S2-0095	رقيه مسلم كريم حسن	EVENING	3	0	0	0	0	2026-11-11 13:47:04.262	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
505c9bf0-c796-4e40-b612-bc632b19baee	96	S2-0096	رنا باسم عبد الكاظم عطيه	EVENING	3	0	0	0	0	2026-11-11 13:47:04.265	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
54721717-b8df-4e15-b8fb-708f5b0be1ed	97	S2-0097	رنا سعد غافل عليوي	EVENING	3	0	0	0	0	2026-11-11 13:47:04.268	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
307c366a-41ef-4dae-a1f5-a8d43f6f9ef8	98	S2-0098	رنا كريم ناصر حسين	EVENING	3	0	0	0	0	2026-11-11 13:47:04.274	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
bac4cb81-20d3-4301-9f0c-99f868c97b11	99	S2-0099	رواء هيثم محسن يحيى	EVENING	3	0	0	0	0	2026-11-11 13:47:04.277	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
68f233bd-127c-4760-bd8e-f5eaff214f44	100	S2-0100	رواق سلمان حسن كاظم	EVENING	3	0	0	0	0	2026-11-11 13:47:04.28	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
f7907a21-2d64-4562-8806-d5fe30376574	101	S2-0101	رويده علاء حسين متعب	EVENING	3	0	0	0	0	2026-11-11 13:47:04.284	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
17bee078-703f-4e9f-b717-69c95fd65b85	102	S2-0102	زهراء ثامر صغير جابر	EVENING	3	0	0	0	0	2026-11-11 13:47:04.29	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
a5404b28-d5f1-4d86-86dc-eff26a7c77c0	103	S2-0103	زهراء ثائر صالح عباس	EVENING	3	0	0	0	0	2026-11-11 13:47:04.295	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
8d071a5e-007c-4f0a-b5ac-b75dcd93c2f2	104	S2-0104	زهراء جاسم جياد حربي	EVENING	3	0	0	0	0	2026-11-11 13:47:04.3	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
b923c0e4-6ff0-4687-a99b-3898f339575a	105	S2-0105	زهراء جاسم فليح حسن	EVENING	3	0	0	0	0	2026-11-11 13:47:04.305	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
4f5490cb-67cf-412c-8e51-5873adbcd313	106	S2-0106	زهراء حسن عبدعون هاشم	EVENING	3	0	0	0	0	2026-11-11 13:47:04.311	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
b337face-1306-425f-a05e-0ad1d6f52d47	107	S2-0107	زهراء حسن محمد عودة	EVENING	3	0	0	0	0	2026-11-11 13:47:04.319	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
fb5fddd5-64ac-4f7e-a8fd-9b2c841389ba	108	S2-0108	زهراء حسين تركي رضار	EVENING	3	0	0	0	0	2026-11-11 13:47:04.324	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
39c69fe7-52f3-4c68-b59e-2935c9507967	109	S2-0109	زهراء خميس جبيرعجيل	EVENING	3	0	0	0	0	2026-11-11 13:47:04.329	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
7d9743f5-4074-44da-ab6b-98ccefb8a483	110	S2-0110	زهراء صادق عيدان ابراهيم	EVENING	3	0	0	0	0	2026-11-11 13:47:04.333	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
8bc77696-eabe-4378-82c0-62b08143483f	111	S2-0111	زهراء طاهر حميد كريم	EVENING	3	0	0	0	0	2026-11-11 13:47:04.339	2026-11-11 13:55:51.939	2	567ccb95-62b5-446f-848b-8b991ce5b18c	\N
24bc5851-32f3-4b99-b221-6e51a3fb7c5e	112	S2-0112	زهراء ظافر ناظم عباس	EVENING	4	0	0	0	0	2026-11-11 13:47:04.342	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
9a64c953-1c87-4298-9e8b-7e7b2cba3154	113	S2-0113	زهراء عباس حسين علي	EVENING	4	0	0	0	0	2026-11-11 13:47:04.345	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
6d07bdc5-8084-4f86-ae8f-883cd72a8cdb	114	S2-0114	زهراء علاء الدين ابراهيم	EVENING	4	0	0	0	0	2026-11-11 13:47:04.349	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
69b3c4fb-c05d-40fd-87dc-596d9c102b26	115	S2-0115	زهراء علي حسين كصاد	EVENING	4	0	0	0	0	2026-11-11 13:47:04.352	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
012cc349-b2fc-4822-b419-36f7c84f9132	116	S2-0116	زهراء علي عبد الحسين جابر	EVENING	4	0	0	0	0	2026-11-11 13:47:04.355	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
7ba4e063-2a7b-41d3-8f19-d75f6c5dfe31	117	S2-0117	زهراء غالب حاتم ذرب	EVENING	4	0	0	0	0	2026-11-11 13:47:04.358	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
e355c8ef-150c-4afc-a0ca-5d4825af534d	118	S2-0118	زهراء ناصر حسين عبد جبر	EVENING	4	0	0	0	0	2026-11-11 13:47:04.361	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
06c52bcc-df4c-4ecc-9f54-5841a692498f	119	S2-0119	زهره عقيل جليل ناجي	EVENING	4	0	0	0	0	2026-11-11 13:47:04.364	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
29b58cae-7144-41c9-b6e9-9a69e5dcbe5e	120	S2-0120	زهور جاسم محسن شكيل	EVENING	4	0	0	0	0	2026-11-11 13:47:04.368	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
3d23c389-176b-4c67-977c-40742cab749b	121	S2-0121	زينب احمد عباس عبد	EVENING	4	0	0	0	0	2026-11-11 13:47:04.37	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
b37f7520-f4f9-4aee-9a4b-f5563ee973c4	122	S2-0122	زينب احمد عبد الحر عبد العباس	EVENING	4	0	0	0	0	2026-11-11 13:47:04.374	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
4f377db8-135b-4a7c-81ed-d62e94c54e77	123	S2-0123	زينب جاسم بايح عبد الله	EVENING	4	0	0	0	0	2026-11-11 13:47:04.38	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
06f5e627-8d29-4d6d-af2e-e4103809f445	124	S2-0124	زينب جعفر ناصر عبد الرضا	EVENING	4	0	0	0	0	2026-11-11 13:47:04.387	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
2d2454e0-ae9f-4eaa-ad90-4ee14984b668	125	S2-0125	زينب حازم كاظم حسين	EVENING	4	0	0	0	0	2026-11-11 13:47:04.391	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
1cdd35dc-44fd-4187-898b-12482a58d764	126	S2-0126	زينب خلاوي شايع محمد	EVENING	4	0	0	0	0	2026-11-11 13:47:04.394	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
b8c44cbb-d893-4d71-8127-7fc9c27d33cb	127	S2-0127	زينب صادق حسن مهدي	EVENING	4	0	0	0	0	2026-11-11 13:47:04.398	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
7ff24735-0e3b-453d-8257-b161789c8d54	128	S2-0128	زينب عدنان كاظم محمد علي	EVENING	4	0	0	0	0	2026-11-11 13:47:04.403	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
52be4ecc-38a7-4f7e-be5a-42795e22f95f	129	S2-0129	زينب علي كامل هاشم	EVENING	4	0	0	0	0	2026-11-11 13:47:04.409	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
591e7d4c-64d5-4554-8d34-cfbc93622a7c	130	S2-0130	زينب غسان عبد الهادي صالح	EVENING	4	0	0	0	0	2026-11-11 13:47:04.412	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
f0c86d64-aa11-4fd8-96a2-319a58a26128	131	S2-0131	زينب قاسم حسين عبد	EVENING	4	0	0	0	0	2026-11-11 13:47:04.416	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
4ab150fa-bbf1-46d6-bca4-2274defd1aed	132	S2-0132	زينب قاسم كتاب عبادي	EVENING	4	0	0	0	0	2026-11-11 13:47:04.42	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
231fd348-cafc-4c0c-b6f9-9b2b83ff7ca8	133	S2-0133	زينب قصي محسن رشيد	EVENING	4	0	0	0	0	2026-11-11 13:47:04.428	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
f5e68653-1281-44e8-9a35-f40f9fff42f4	134	S2-0134	زينب محمد عبد الله محسن	EVENING	4	0	0	0	0	2026-11-11 13:47:04.43	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
e5b2ea54-5acc-4d27-8a64-29c5f8d778f4	135	S2-0135	زينب منير حسين كاظم	EVENING	4	0	0	0	0	2026-11-11 13:47:04.433	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
c27f352d-7738-49da-8313-877351b22ad4	136	S2-0136	زينب مهدي علي عبد	EVENING	4	0	0	0	0	2026-11-11 13:47:04.435	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
4982edbf-0548-4453-8b0e-2df927577213	137	S2-0137	زينب نورس جميل راهي	EVENING	4	0	0	0	0	2026-11-11 13:47:04.438	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
b310b4fe-c9bc-4c88-b230-f57ba3c4bede	138	S2-0138	زينب هاشم حسن محسن	EVENING	4	0	0	0	0	2026-11-11 13:47:04.441	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
b636a416-71f5-4b29-8072-7120b574cad0	139	S2-0139	زينب ياسين خضير عباس	EVENING	4	0	0	0	0	2026-11-11 13:47:04.444	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
86172170-ea4a-4217-8600-eaed32775506	140	S2-0140	زينب يونس ذنون يونس	EVENING	4	0	0	0	0	2026-11-11 13:47:04.446	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
8342fda5-a147-4cb2-928f-1cb268f2f6d8	141	S2-0141	زينه حسين عبد الامير حسن	EVENING	4	0	0	0	0	2026-11-11 13:47:04.448	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
5c411562-30d2-481c-866a-70fdaa8c1824	142	S2-0142	زينه رحيم عبد الحسن هاشم	EVENING	4	0	0	0	0	2026-11-11 13:47:04.451	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
0751af89-9384-49fd-9e85-be9e2f7c3607	143	S2-0143	ساره حسام مهدي محمد	EVENING	4	0	0	0	0	2026-11-11 13:47:04.453	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
196b2727-c418-4538-8487-ae2d85ba96e3	144	S2-0144	ساره عباس شاكر رشيد	EVENING	4	0	0	0	0	2026-11-11 13:47:04.455	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
6a8a563c-f6b4-4901-a9b2-11d811a119b9	145	S2-0145	ساره عبد الامير كريمز فليح	EVENING	4	0	0	0	0	2026-11-11 13:47:04.457	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
542d85a0-42ac-407b-a3ec-0e1baf64afca	146	S2-0146	ساره محمد عبد علي اسماعيل	EVENING	4	0	0	0	0	2026-11-11 13:47:04.46	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
5385c113-aa49-4835-876c-ae2b2daba6af	147	S2-0147	ساره مروان كامل مسرهد	EVENING	4	0	0	0	0	2026-11-11 13:47:04.462	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
fcd2bb03-5fee-450d-8de7-ebdb8adca311	148	S2-0148	ستار طالب سهيل هلول	EVENING	4	0	0	0	0	2026-11-11 13:47:04.464	2026-11-11 13:55:51.939	2	01e1b86f-19ff-4e51-a236-e30b97f47689	\N
dd77d02f-fe28-4671-b198-45afd65b13f8	149	S2-0149	سجاد حسين عليوي ناصر	EVENING	5	0	0	0	0	2026-11-11 13:47:04.466	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
2d9656df-e605-4cc7-8d80-c1f27f16869c	150	S2-0150	سجاد سعد عبيس حميد	EVENING	5	0	0	0	0	2026-11-11 13:47:04.469	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
dd51884a-dfe8-40ad-a14d-1d1a02900912	151	S2-0151	سجاد عبد العزيز مزهر	EVENING	5	0	0	0	0	2026-11-11 13:47:04.471	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
e1a7eeef-d8a9-4792-8019-4d714cb4c7d0	152	S2-0152	سجاد قصي جعفر كاظم	EVENING	5	0	0	0	0	2026-11-11 13:47:04.474	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
5891fedb-2152-4a93-867e-8dcc6d003723	153	S2-0153	سجى ضياء حسين عبود	EVENING	5	0	0	0	0	2026-11-11 13:47:04.476	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
eff653d6-4383-414f-991f-3b1bbc064992	154	S2-0154	سرى احسان نجم عبد	EVENING	5	0	0	0	0	2026-11-11 13:47:04.479	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
1535947b-672b-4d53-b51a-985714e1e1dc	155	S2-0155	سرى سيف هادي عاشور	EVENING	5	0	0	0	0	2026-11-11 13:47:04.481	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
488c36a7-a114-4666-bf0b-88078624ebca	156	S2-0156	شهد ستار عبد سلمان	EVENING	5	0	0	0	0	2026-11-11 13:47:04.484	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
e8b1091d-ed19-4189-896b-742a96743d77	157	S2-0157	شهد عامر عبد الحمزه راضي	EVENING	5	0	0	0	0	2026-11-11 13:47:04.486	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
0bf43e2f-5ab0-4b7a-8858-4ef8ccfbe7cc	158	S2-0158	شهد نجاح راضي مغير	EVENING	5	0	0	0	0	2026-11-11 13:47:04.489	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
4dcc34db-64ae-446d-9a65-5a949b566304	159	S2-0159	شيماء شريف علي جمعه	EVENING	5	0	0	0	0	2026-11-11 13:47:04.491	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
67786e30-a58d-47d0-8985-94940018c06b	160	S2-0160	شيماء عدنان حواس عوفي	EVENING	5	0	0	0	0	2026-11-11 13:47:04.494	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
5626a783-15bc-4f9e-9e92-e7aa26b29683	161	S2-0161	صابرين حاضر عواد شيال	EVENING	5	0	0	0	0	2026-11-11 13:47:04.496	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
f7a502cd-3f33-4ce6-8bf4-d65fbb6575fc	162	S2-0162	صادق زهير عزيز عبيد	EVENING	5	0	0	0	0	2026-11-11 13:47:04.498	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
e198b8f1-540c-4888-a500-694c5b4cc117	163	S2-0163	صادق سلمان حياوي علي	EVENING	5	0	0	0	0	2026-11-11 13:47:04.501	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
bf32f511-db93-49d3-b927-8775dd9d8ea4	164	S2-0164	صادق فالح حسن جبار	EVENING	5	0	0	0	0	2026-11-11 13:47:04.503	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
47ad7cee-91e6-4d25-8844-54506f964c03	165	S2-0165	صبا احمد عبد الرضا بردان	EVENING	5	0	0	0	0	2026-11-11 13:47:04.505	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
1473f56f-6b88-493d-9397-6ad02d09f501	166	S2-0166	صالح فالح حسن عبد الساده	EVENING	5	0	0	0	0	2026-11-11 13:47:04.508	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
8b8254e1-5e9b-410d-bb94-bde83b83127c	167	S2-0167	ضحى ثائر غازي باره	EVENING	5	0	0	0	0	2026-11-11 13:47:04.51	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
0ee83df0-3013-45ac-99de-5a3aa44b5f20	168	S2-0168	ضحى عباس سعيد ادريس	EVENING	5	0	0	0	0	2026-11-11 13:47:04.513	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
f2ffa8db-cd38-45ed-804c-25ff73604e06	169	S2-0169	ضحى محمد عارف عبد	EVENING	5	0	0	0	0	2026-11-11 13:47:04.516	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
05d0660a-20c6-4d8f-8020-8f786105e652	170	S2-0170	طيبة احمد راضي حسن	EVENING	5	0	0	0	0	2026-11-11 13:47:04.518	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
4fb7e13f-cbc9-4bd6-aed7-0efbbe5b467f	171	S2-0171	طيبة حسن كاظم شخير	EVENING	5	0	0	0	0	2026-11-11 13:47:04.521	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
5cb1dac0-56ff-4c7a-be8a-2178365d36af	172	S2-0172	طيبة عباس عبد الكاظم حمود	EVENING	5	0	0	0	0	2026-11-11 13:47:04.523	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
b77ef299-8d35-4237-83b0-6c1b65e2d205	173	S2-0173	طيبه قيس عيدان حمزه	EVENING	5	0	0	0	0	2026-11-11 13:47:04.526	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
57526353-e3cb-43c3-a9be-d4fdfc1d4b1e	174	S2-0174	طيبه وسام حمزه جواد	EVENING	5	0	0	0	0	2026-11-11 13:47:04.53	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
edbae7bc-b600-4c51-b228-ec9677d78565	175	S2-0175	طيبه وسام عادل خضر	EVENING	5	0	0	0	0	2026-11-11 13:47:04.532	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
2d313bb1-5df0-4798-a93a-5d7808efac6a	176	S2-0176	عباس صباح نجم عبد	EVENING	5	0	0	0	0	2026-11-11 13:47:04.535	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
d4aaa83b-9ec1-4435-a52e-557c91fbfede	177	S2-0177	عباس علي عبد الحسين	EVENING	5	0	0	0	0	2026-11-11 13:47:04.537	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
7863920c-c52a-4145-bac1-cbee7773aee7	178	S2-0178	عباس علي محسن عبد	EVENING	5	0	0	0	0	2026-11-11 13:47:04.539	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
c6c277b9-9a8d-4156-a580-5c73a9f9143f	179	S2-0179	عباس نعمان كشاش عبيس	EVENING	5	0	0	0	0	2026-11-11 13:47:04.542	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
19b12400-6857-4cd1-b531-0a359425d793	180	S2-0180	عبد الله حسن صاحب عوده	EVENING	5	0	0	0	0	2026-11-11 13:47:04.544	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
9377b43f-846b-4c43-b416-fba0163e8a1e	181	S2-0181	عبد الله حسين غافل رشيد	EVENING	5	0	0	0	0	2026-11-11 13:47:04.546	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
0d36ca84-1828-4307-805c-f62c12d6f88a	182	S2-0182	عبد الله محمد محمود طالب	EVENING	5	0	0	0	0	2026-11-11 13:47:04.548	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
7d88b71e-daa8-4ed3-aa3e-2cbcfc42186c	183	S2-0183	عبير احمد عايد محمد	EVENING	5	0	0	0	0	2026-11-11 13:47:04.551	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
d561f381-da71-4add-9754-38d7274c4640	184	S2-0184	عبير رياض خوام وذاح	EVENING	5	0	0	0	0	2026-11-11 13:47:04.554	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
69588e42-1922-4d25-8b57-87f26061b2f4	185	S2-0185	عذراء حسين علي كاظم	EVENING	5	0	0	0	0	2026-11-11 13:47:04.556	2026-11-11 13:55:51.939	2	fbfdaf04-5337-4a45-b884-34ee187902b1	\N
2551524c-c0c7-4cdb-8791-b131960bb78f	186	S2-0186	عذراء علاء عادل العيوس	EVENING	6	0	0	0	0	2026-11-11 13:47:04.559	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
45c46aa1-94fe-4ee7-a217-a40d62a46ee3	187	S2-0187	عذراء محمد عبود طاهر	EVENING	6	0	0	0	0	2026-11-11 13:47:04.561	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
1f08e179-5472-4dfd-894f-0d4ad62d3049	188	S2-0188	عسل جبار عبد زيد جاسم	EVENING	6	0	0	0	0	2026-11-11 13:47:04.563	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
c8a6b363-beaf-4fc3-b196-ce189955e99f	189	S2-0189	علي ثائر شريف هنيدي	EVENING	6	0	0	0	0	2026-11-11 13:47:04.566	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
a2921b16-78a0-4430-9d59-601301c47f3f	190	S2-0190	علي جعفر عبد الصادق حسين	EVENING	6	0	0	0	0	2026-11-11 13:47:04.568	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
74d6fe6b-b52b-40cb-bc36-7ee9bcea0d65	191	S2-0191	علي حسين حمزة علي	EVENING	6	0	0	0	0	2026-11-11 13:47:04.571	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
58996bac-a96b-4670-a7ec-0a71aa57de1c	192	S2-0192	علي حسين حميد جابر	EVENING	6	0	0	0	0	2026-11-11 13:47:04.573	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
b856be16-f83d-4cf8-9751-3c2413f677e3	193	S2-0193	علي حسين خليل ابراهيم	EVENING	6	0	0	0	0	2026-11-11 13:47:04.575	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
b9f66c33-c87d-4442-b9ff-bf453911192c	194	S2-0194	علي رعد عبد المحسن جثير	EVENING	6	0	0	0	0	2026-11-11 13:47:04.578	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
ccbc31ef-2996-436f-b4f0-f89cb8be4eec	195	S2-0195	علي صباح بردان لطيف	EVENING	6	0	0	0	0	2026-11-11 13:47:04.58	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
45edecc3-8af2-480d-8f8d-409efa9af45c	196	S2-0196	علي فراس فاضل واجد	EVENING	6	0	0	0	0	2026-11-11 13:47:04.583	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
3c356089-8431-4e76-bdbc-77726631ba4a	197	S2-0197	علي كامل عباس عيسى	EVENING	6	0	0	0	0	2026-11-11 13:47:04.586	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
bec44d33-9aa2-4745-afe6-fb6488590874	198	S2-0198	علي ماجد حسن عبيس	EVENING	6	0	0	0	0	2026-11-11 13:47:04.588	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
23d82a8b-17c9-4e1d-96a1-4a1367fab702	199	S2-0199	علي محمد علي جعفر حمزه	EVENING	6	0	0	0	0	2026-11-11 13:47:04.591	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
25b58b88-b9f1-4d9d-8e01-281e2878635a	200	S2-0200	علي محمد ناصر لزام	EVENING	6	0	0	0	0	2026-11-11 13:47:04.595	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
78637917-13a5-4622-a891-ff83d225008b	201	S2-0201	علي مسلم جخير الزم	EVENING	6	0	0	0	0	2026-11-11 13:47:04.597	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
82ec7b25-4ee2-48c6-90e3-6f3666456c28	202	S2-0202	عماد الياس خضير احمد	EVENING	6	0	0	0	0	2026-11-11 13:47:04.6	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
b579dfd2-b491-4231-9b39-68d6ea492330	203	S2-0203	عمار ياسر عبد الكاظم رميض	EVENING	6	0	0	0	0	2026-11-11 13:47:04.603	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
aea153ec-2bc6-464e-9ece-84f38374c75e	204	S2-0204	غدير حاتم كريم جياد	EVENING	6	0	0	0	0	2026-11-11 13:47:04.609	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
9b48a04c-5604-40d4-84df-05593a4a6ced	205	S2-0205	غدير شاكر حميد ياسين	EVENING	6	0	0	0	0	2026-11-11 13:47:04.616	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
2c6846db-e774-4c4c-a2e9-2141ff704bf3	206	S2-0206	غدير عبد الزهره ناظم عويد	EVENING	6	0	0	0	0	2026-11-11 13:47:04.623	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
d72553a5-d42b-42d5-86d8-6a1cf3308e02	207	S2-0207	غدير عدنان سلمان كاظم	EVENING	6	0	0	0	0	2026-11-11 13:47:04.631	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
b674f00f-b2f3-4069-8c27-823ab78cad06	208	S2-0208	غدير هاشم حسن عبد عون	EVENING	6	0	0	0	0	2026-11-11 13:47:04.636	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
570e09e5-5bfd-4f57-bfe5-53c6f3f75ab6	209	S2-0209	غسق يونس حميد مجبل	EVENING	6	0	0	0	0	2026-11-11 13:47:04.642	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
13cebd29-71a1-4777-bc90-345faea37ae1	210	S2-0210	غفران محمد حمزه كاظم	EVENING	6	0	0	0	0	2026-11-11 13:47:04.648	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
55ce78b4-59fd-4039-baa6-ccca23e07293	211	S2-0211	غيداء فاضل عبد مسلم جاسم	EVENING	6	0	0	0	0	2026-11-11 13:47:04.652	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
7540c041-9b1a-46ab-bc5b-ef51f8ad967b	212	S2-0212	فاطمة احمد حسين جاسم	EVENING	6	0	0	0	0	2026-11-11 13:47:04.655	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
3a9af331-dc25-43e2-8872-15d71239d18d	213	S2-0213	فاطمة الزهراء احمد عبد الامير هادي	EVENING	6	0	0	0	0	2026-11-11 13:47:04.66	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
4392fe2d-ed36-4440-89b2-a8a07c89c900	214	S2-0214	فاطمة حسين صالح ضهد	EVENING	6	0	0	0	0	2026-11-11 13:47:04.663	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
11d3c191-908b-48b4-9aca-f3a024eb3bff	215	S2-0215	فاطمة خليل عبد الكاظم شمران	EVENING	6	0	0	0	0	2026-11-11 13:47:04.666	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
18581649-b37a-4166-89b5-56278448aae3	216	S2-0216	فاطمة رياض عبد حسين	EVENING	6	0	0	0	0	2026-11-11 13:47:04.669	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
72351dca-0bdb-43c7-a49e-71dcbd1fee89	217	S2-0217	فاطمة سالم عباس صليب	EVENING	6	0	0	0	0	2026-11-11 13:47:04.673	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
51b5d6a3-5b50-440d-8338-f49d182b75d7	218	S2-0218	فاطمة سعد جبر عطيه	EVENING	6	0	0	0	0	2026-11-11 13:47:04.676	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
bb89b5fb-30d5-42ce-b32f-ac461dbddd60	219	S2-0219	فاطمة عبد الخالق عباس عبد الكريم	EVENING	6	0	0	0	0	2026-11-11 13:47:04.679	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
5388e3d9-2cab-49f8-befe-077be42f4b6b	220	S2-0220	فاطمة عبد الزهرة حميد عبد الكريم	EVENING	6	0	0	0	0	2026-11-11 13:47:04.683	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
9ffede72-a098-4264-b490-ba65abd778e2	221	S2-0221	فاطمة علاء جليل حسين	EVENING	6	0	0	0	0	2026-11-11 13:47:04.686	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
8f6cce71-d71a-47b1-a9db-1b4c72bd4164	222	S2-0222	فاطمة علي محيسن كاظم	EVENING	6	0	0	0	0	2026-11-11 13:47:04.689	2026-11-11 13:55:51.939	2	43897e7f-b159-4093-beac-4a0cc42d5782	\N
d703acd2-0fbe-4c32-a177-75a6923f48c9	223	S2-0223	فاطمة فرحان حسن حسين	EVENING	7	0	0	0	0	2026-11-11 13:47:04.691	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
d0937df2-a06a-4e4c-8358-5a23159c7d10	224	S2-0224	فاطمة قائد تركي لوكان	EVENING	7	0	0	0	0	2026-11-11 13:47:04.694	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
876f1106-6cfb-426d-9385-0b8620f510b4	225	S2-0225	فاطمة يوسف كاظم روكان	EVENING	7	0	0	0	0	2026-11-11 13:47:04.697	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
caa5c4f3-09a9-41f8-8cc0-0c49059eb883	226	S2-0226	فرح خضير حسين عجيل	EVENING	7	0	0	0	0	2026-11-11 13:47:04.701	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
8f457301-777e-4e46-bb16-9e513d503b8f	227	S2-0227	فرقان عدنان جبر رحيم	EVENING	7	0	0	0	0	2026-11-11 13:47:04.705	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
951fe6b5-c0ee-4f67-b56d-04e9dab757e1	228	S2-0228	كاظم فاضل كاظم ظاهر	EVENING	7	0	0	0	0	2026-11-11 13:47:04.708	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
2f700487-3647-4b74-bf43-b0c9e4fa1392	229	S2-0229	كرار جواد كاظم حسين	EVENING	7	0	0	0	0	2026-11-11 13:47:04.711	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
fc86659a-bf9b-4b0b-96b1-bef3d385c0b1	230	S2-0230	كرار حيدر عبد الامير عبد	EVENING	7	0	0	0	0	2026-11-11 13:47:04.715	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
e858710e-c6bc-4393-ad64-55802e1fa3bc	231	S2-0231	كوثر علي عبد الحسين عباس	EVENING	7	0	0	0	0	2026-11-11 13:47:04.719	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
d962e466-a8ff-4a9a-9288-7f0be3955408	232	S2-0232	كوثر عيدان فضاله عبود	EVENING	7	0	0	0	0	2026-11-11 13:47:04.725	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
5e886801-1477-4204-aa25-9b41fdaffba5	233	S2-0233	كوثر قاسم محمد نعمه	EVENING	7	0	0	0	0	2026-11-11 13:47:04.729	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
f9dc580f-def6-4737-ab7a-e4dc8ab0205a	234	S2-0234	كوثر مظلوم جاسم فليح	EVENING	7	0	0	0	0	2026-11-11 13:47:04.733	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
b269b39b-9fdb-44d1-a42b-c07620b42e3c	235	S2-0235	كوثر هاشم عبد علي يسن	EVENING	7	0	0	0	0	2026-11-11 13:47:04.738	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
efdaa985-50e6-46e4-ad2c-555f575fbd93	236	S2-0236	محمد احسان علي حسين	EVENING	7	0	0	0	0	2026-11-11 13:47:04.741	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
31523151-aae8-4f0d-8095-54803334de83	237	S2-0237	محمد الصدر علي بدر ناصر	EVENING	7	0	0	0	0	2026-11-11 13:47:04.745	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
5e9823ef-b025-469b-943d-b6e54e923f35	238	S2-0238	محمد حاتم جميل حنون	EVENING	7	0	0	0	0	2026-11-11 13:47:04.748	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
2e33c729-e464-470e-8c1a-2a2d76c4adba	239	S2-0239	محمد حسين زامل عبدعون	EVENING	7	0	0	0	0	2026-11-11 13:47:04.751	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
c7514e5e-7816-4df5-97ac-89e47be6afad	240	S2-0240	محمد سامي ابراهيم شريف	EVENING	7	0	0	0	0	2026-11-11 13:47:04.755	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
34e91cad-c7b4-4d8c-be5b-77ebd80eea91	241	S2-0241	محمد سعد عبد اللطيف جاسم	EVENING	7	0	0	0	0	2026-11-11 13:47:04.758	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
606898f6-0689-4922-a723-d220846b3d71	242	S2-0242	محمد صباح رزاق جهادي	EVENING	7	0	0	0	0	2026-11-11 13:47:04.761	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
93a081ad-34dc-4c22-8742-4e1ac648dedc	243	S2-0243	محمد علي هادي محمد سعيد	EVENING	7	0	0	0	0	2026-11-11 13:47:04.765	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
d77f7511-00a6-4b37-b70e-31bc531dc7be	244	S2-0244	محمد قائد حمزة مهدي	EVENING	7	0	0	0	0	2026-11-11 13:47:04.768	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
547ffaf3-5aea-48c6-b7ef-ad32b7007059	245	S2-0245	محمد محسن ضمد	EVENING	7	0	0	0	0	2026-11-11 13:47:04.771	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
3b4d1df2-847f-4742-a33b-698af90ce51f	246	S2-0246	مرام خالد علي حسن	EVENING	7	0	0	0	0	2026-11-11 13:47:04.774	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
89013cc2-fd79-43a4-877e-97b2a80d78ab	247	S2-0247	مروه عطا الله حسين كاظم	EVENING	7	0	0	0	0	2026-11-11 13:47:04.777	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
7d505237-c843-443a-bbc9-b6fd1667b0ec	248	S2-0248	مريم ضياء عبد الحميد زباله	EVENING	7	0	0	0	0	2026-11-11 13:47:04.781	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
f203d07d-142a-4ad3-8cdc-8b8ed01f37e2	249	S2-0249	مريم فارس عبد الحسن محمد	EVENING	7	0	0	0	0	2026-11-11 13:47:04.785	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
efd89118-dfad-4cbd-9e82-0200b03e81bc	250	S2-0250	مريم محمد فليح حسن	EVENING	7	0	0	0	0	2026-11-11 13:47:04.789	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
1d066434-c12f-48b6-af88-5180a70dc6bc	251	S2-0251	مصطفى احمد عبيد حداوي	EVENING	7	0	0	0	0	2026-11-11 13:47:04.794	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
4b4c1951-d6b7-4bc0-a2fa-c0293f32e9b9	252	S2-0252	مصطفى احمد وحيد ابراهيم	EVENING	7	0	0	0	0	2026-11-11 13:47:04.799	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
ad1a82b8-1b60-4cfb-a3f6-64f9b2234def	253	S2-0253	مصطفى حربي داهي شنون	EVENING	7	0	0	0	0	2026-11-11 13:47:04.803	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
49e286c3-d440-4590-ba9d-604b1ca579ff	254	S2-0254	مصطفى حيدر حسين علي	EVENING	7	0	0	0	0	2026-11-11 13:47:04.807	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
784937f0-0562-481c-b6c7-d2f71d82a29d	255	S2-0255	مصطفى سعود كاظم زينل	EVENING	7	0	0	0	0	2026-11-11 13:47:04.813	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
7e3ad3dd-ccea-4b5d-9bce-fe208bc1f22b	256	S2-0256	مصطفى علي عبدين شهباز	EVENING	7	0	0	0	0	2026-11-11 13:47:04.816	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
bc9dd19f-183e-436e-81bf-4e8742c56c8c	257	S2-0257	مصطفى ياس خضير صخي	EVENING	7	0	0	0	0	2026-11-11 13:47:04.822	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
fa04a1fa-53f3-48be-a18c-80f70dd0d222	258	S2-0258	معصومه سالم حسين كاظم	EVENING	7	0	0	0	0	2026-11-11 13:47:04.825	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
f31eea6c-7784-4ef9-b177-ba6d2c9e9b4d	259	S2-0259	مقتدى خالد كريم هداد	EVENING	7	0	0	0	0	2026-11-11 13:47:04.83	2026-11-11 13:55:51.939	2	a47c3505-eca8-478b-9df3-91e5504811fa	\N
dd5f1434-c289-4193-bf43-a205467559a7	260	S2-0260	مقتدى علي حسين مبلط	EVENING	8	0	0	0	0	2026-11-11 13:47:04.835	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
d2fd5ade-27e2-4c8f-a640-a09d0317d6ab	261	S2-0261	مقتدى مهند سلمان مكطوف	EVENING	8	0	0	0	0	2026-11-11 13:47:04.84	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
304fb205-8a9d-4956-8be4-98827a064211	262	S2-0262	مالك حليم نوماس تكليف	EVENING	8	0	0	0	0	2026-11-11 13:47:04.844	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
4af7354c-579a-457d-9bdb-061e05f88d89	263	S2-0263	مالك سعد عبد الحسين خضير	EVENING	8	0	0	0	0	2026-11-11 13:47:04.859	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
784d64ec-16d4-4765-a996-b4f1c8dc470b	264	S2-0264	منار حسين علوان ناصر	EVENING	8	0	0	0	0	2026-11-11 13:47:04.868	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
aadd1fad-0205-4958-b475-4d69402e3527	265	S2-0265	منار عزيز عباس محمد	EVENING	8	0	0	0	0	2026-11-11 13:47:04.874	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
95fa6717-7431-4e13-8899-71c4eba8b31c	266	S2-0266	منتظر علي عبد الخضر وناس	EVENING	8	0	0	0	0	2026-11-11 13:47:04.877	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
fd79bd13-66f8-47fd-ae2f-495db9072fb4	267	S2-0267	منى برير محمد صالح حماده	EVENING	8	0	0	0	0	2026-11-11 13:47:04.881	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
fe544783-e1cf-4a56-b323-56c0814c3f57	268	S2-0268	مها فيصل صلال وذاح	EVENING	8	0	0	0	0	2026-11-11 13:47:04.885	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
4068e93c-32de-4071-828a-d536e0d14285	269	S2-0269	مهند ميري جدوع صراي	EVENING	8	0	0	0	0	2026-11-11 13:47:04.889	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
2f7cbbc9-b688-42ca-a513-d3a87558d3e3	270	S2-0270	موسى مطر محسن عبادي	EVENING	8	0	0	0	0	2026-11-11 13:47:04.892	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
c2e6053a-6a59-4afc-8637-c0dcf80e6573	271	S2-0271	مؤمل اياد جاسم كاظم	EVENING	8	0	0	0	0	2026-11-11 13:47:04.895	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
1415474c-466e-468c-94ef-aee68c31766a	272	S2-0272	نبا حسن محسن عزيز	EVENING	8	0	0	0	0	2026-11-11 13:47:04.898	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
4641446f-1149-4a57-a669-7287f119dd8a	273	S2-0273	نبا حميد طالب هاشم	EVENING	8	0	0	0	0	2026-11-11 13:47:04.902	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
759f20ef-2b57-45a0-b056-cb94ab14ed45	274	S2-0274	نبا حيدر عبد الامير	EVENING	8	0	0	0	0	2026-11-11 13:47:04.905	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
5341e676-9aff-472f-893c-54299922d4de	275	S2-0275	نبا محمد خميس فاضل	EVENING	8	0	0	0	0	2026-11-11 13:47:04.907	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
850609be-7f71-4b7c-aedd-73de0f828cc4	276	S2-0276	نرجس خير الله فارس مناتي	EVENING	8	0	0	0	0	2026-11-11 13:47:04.91	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
2ec69ba1-f748-4003-9080-d2b8d471b14a	277	S2-0277	نغم غالب خضير محمد	EVENING	8	0	0	0	0	2026-11-11 13:47:04.913	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
e6514727-9c9e-4e02-98a4-23311765c246	278	S2-0278	نور احمد عبد الكاظم حسن	EVENING	8	0	0	0	0	2026-11-11 13:47:04.916	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
a10eebb3-1e1a-4df7-a0e0-a6ddb39e6ea2	279	S2-0279	نور الهدى اكرم سكر زهراو	EVENING	8	0	0	0	0	2026-11-11 13:47:04.92	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
1fc067e8-20fc-418f-b362-f137888d1842	280	S2-0280	نور حيدر علي عبد الامير	EVENING	8	0	0	0	0	2026-11-11 13:47:04.924	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
89e3bf8a-cf9d-4410-92cd-3d2baddce277	281	S2-0281	نور علي جوري عبد الوهاب	EVENING	8	0	0	0	0	2026-11-11 13:47:04.927	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
54c5229c-fb70-46da-9415-88ce12e4539f	282	S2-0282	نور كامل رسول هاشم	EVENING	8	0	0	0	0	2026-11-11 13:47:04.931	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
dad33b2c-6938-4f8a-a907-3108bda720b6	283	S2-0283	نور كريم ناصر حسين	EVENING	8	0	0	0	0	2026-11-11 13:47:04.934	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
7f8fd615-958b-4ed8-b195-f0cb0fb1ece8	284	S2-0284	هاجر علي عبيد هادي	EVENING	8	0	0	0	0	2026-11-11 13:47:04.938	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
caec61fb-9166-4c7c-bdd9-6164fd630103	285	S2-0285	هبه حميد كريم عبد	EVENING	8	0	0	0	0	2026-11-11 13:47:04.941	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
b8d54cd0-7d1f-4b08-a141-2605190b3ceb	286	S2-0286	هجران محمد عطشان عبد الله	EVENING	8	0	0	0	0	2026-11-11 13:47:04.945	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
2614e036-6348-4a42-8b9d-258139572ed6	287	S2-0287	ورود حامد شاطي كاظم	EVENING	8	0	0	0	0	2026-11-11 13:47:04.948	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
70db5730-7e6b-4854-a5bc-437f2433cfe5	288	S2-0288	ياسمين جاسم محمد منسي	EVENING	8	0	0	0	0	2026-11-11 13:47:04.953	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
5f459b8d-9664-4dc2-b8ad-8426a286271b	289	S2-0289	يوسف عباس عجمي سالم	EVENING	8	0	0	0	0	2026-11-11 13:47:04.957	2026-11-11 13:55:51.939	2	b35abf9d-5911-405d-85f1-e2700c50cf1d	\N
\.


--
-- Data for Name: StudentQrToken; Type: TABLE DATA; Schema: public; Owner: attendance_user
--

COPY public."StudentQrToken" (id, "studentId", token, "revokedAt", "createdByUserId", "createdAt") FROM stdin;
69c7fc97-08b3-452d-a6e4-3af28e63abae	27ea5086-ccbb-4512-aaad-ef62e8330165	qr_c0OVc7_q-nX2X1Ghx9lH53IWLf0vRiEC	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:03.956
a79f035e-d00f-4cc4-8e49-ecfb70eb41b6	d699ee56-b396-4b7f-bddf-61897dede2dd	qr_sQNQ3MXP_9069YCzowqlZlQPN7lunVuD	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:03.974
e18a805a-c633-45f6-8668-55192d5d3da2	c9639728-b9a7-448a-81c6-c39d41e49d35	qr_lj_fyFI-PUwVtTf7dDZ4vY6pwW_Py2mP	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:03.978
596d2a4a-2bde-440d-8f39-a2a425ad8832	689d3015-1d30-4720-b65b-07cf1bca1c54	qr_w5VU_Zfyg7lU7sCC92gJ7rn8EFVAZyt8	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:03.98
9dcfc597-4683-4f0e-8b90-b77ab1752311	6aeb1c4c-3292-4795-9fbc-551fb5b3b4e2	qr_PcX2OpBTDC_nYfQn85wvFmojKbFmPVFX	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:03.983
d875c836-a7c3-42c6-8789-d71b1ea3d896	ab135a17-ff78-4ade-b4c3-e0c6b385bc7b	qr_c_5y1DjpxNjn-nHW3YeAr5guiydMJllM	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:03.988
8bc9e68f-c9be-4cad-b6a5-e04228303f52	6b0cda60-acb4-4df4-bd56-32aac11f20a0	qr_xOsrvQJ2UuLsbst2uW-vIQu4L7XqW_sC	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:03.991
fdedf8ec-3736-47e7-9a92-959caefb9f60	e0ca59d1-df56-4f8d-b324-ae6a2f606e1d	qr_AUULV5W0paJ8eNkTgO1Nx79r1X7wjAOx	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:03.993
4e59ac9c-91fc-40b7-b0e6-be1939744af3	2ef82f0d-53be-4e25-85f7-06a318c226e0	qr_WtLUMnhlFFY2elp2ui5Y0bFvt2t3cz3_	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:03.996
302c4dee-6ce5-41d3-8793-b256237ad942	174d537a-794d-42c3-b58f-90fe79f9377a	qr_PuM5_8YV5fWoeeVhl16LLi51KO59sCXN	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:03.998
a3012877-0971-4fa0-9e2e-8bd54a1c59ed	96711f4d-2aef-4155-8c73-71f92db67666	qr_aWoIaCuu3sCKjZubGzjKG0zAxYqRy7CA	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.001
d4f4deee-1bac-4099-b261-c9bf3745dc14	1c25efc6-b368-4e9b-bd8b-5f9c35ab3fea	qr_PmF7TTpOWR5ii4CCjCAErjWe2rS8We4N	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.003
889cc200-aace-47f7-b03a-a01cbfe9eb6e	b701252f-fa78-4543-b168-c3587646fa50	qr_mbkCpjkgU71e_nMZ9YXueCNui5R1kIfV	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.005
4ec1b08c-31c3-4cc1-aba5-920ef7dfdd6e	5428c90e-2965-4314-8b7e-d8fa1b115a11	qr_D_EMlnIIuwRt-mXDRDy6J90yH3g5epqt	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.008
374db26c-1bc1-4157-a0bd-8eaf81c68540	388486bb-3626-435d-8592-70447e629004	qr_BM6-HZf5Gn-gGHGa4jjqp7gusA0L2SPT	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.01
eb518d65-5c54-4a0a-9323-631086be3a27	62cf95e6-c8ee-493f-9a30-edd816d28965	qr_65NyFLOY-ez2Kr98lQt2Zn-zDTXtSpUF	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.013
ec9a2575-e0ed-4c15-94e8-60234bffd78e	4da2d449-05c0-4ad2-a95c-91f0f4fe806d	qr_rbgoEVuEVprWcKVtiTh78KuvTiTAENAr	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.015
7c9d2eef-0401-47be-a309-beef45a6b848	72b8ac2b-520d-41ed-929f-bc8e14e7c4d1	qr_RhHVtcAJ4AYMAV6PZhoahI1LcnOKBA40	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.018
1f728ea0-82f8-4590-8466-51b434998012	94579fd0-5149-4925-92a7-3aac83913062	qr_05sJpYzWZ_kUhL7InyLAGuFKBBX-iVLG	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.02
decf133b-fc95-4552-aa0c-4404757f3fb4	6ea84971-39db-4cf7-8445-b369e5992e72	qr_36Unja2ORc7NidO5OepTDZeNhqpn2abs	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.023
e84d9318-cb25-4f1d-9063-fee3ee7a889c	011c44d9-5695-46a7-9d11-09e41fed0277	qr_X4e3-BldSN5MAI-0wZ1bX3xX-MeRBztu	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.025
7620de8e-7b9a-4091-b568-065db65b9ad8	d58ca823-758c-4101-b87d-c82830213d90	qr_Rpbwetx_Xbw0xMFiH8uyCorz4bS375Ty	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.028
bce3f42d-aa2c-4f26-a62d-80c0b0749d0f	0e93f95d-5c04-40d4-94df-391fa8a996c4	qr_pQAI7RrnvjfR4N5dBwR32kjRUjXKj3IU	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.03
c1c21773-f8d0-48cc-ae23-b6d817ed09ec	c2ac513a-5a25-4821-807c-b6a1f99a8a64	qr_SSWsLAuAvMl5cn4hHDjfIt0irorwCyxL	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.032
334942e8-51f3-4d29-86fe-4307f8b1df4d	ce92274e-7960-45f3-bfe4-fc5bb3b2e20a	qr_bx_mX4YvXv6eWV5y_bPwysuWGIczznHx	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.035
f8c4db47-fe8f-4572-9fce-f117f0576241	feb0a3eb-32a9-41d3-9f16-db2de0360c0e	qr_i1Jyurd2jLmM6RDYW15PDrVcGwQihRQk	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.037
88758169-2972-4aae-9569-ea1b7a425781	350041ef-fff9-4fd8-ac1c-f56d6184dff2	qr_mrffkyF7u-YZ40AX0hl9YqcEzAsxzMkk	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.04
fa4c68e7-1eb2-43cb-a55f-af1f61c9bc37	7900dedd-8499-416d-8ad6-0ac8027e4195	qr_xrMPbFN7xeM1n_7QdX9_u6ODnvcXHLzK	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.042
2858d394-555d-4641-82a2-71bc63d5eefa	6d87e4ea-88d0-4c95-aad0-9b5aa71ed315	qr_3jXPF3jN7FZSAW1UmgHHkikq6pw63Ipj	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.045
393fa043-0696-473c-a82e-85ba35caa572	716fc3c8-22db-449e-818e-acd82807a555	qr_u6UzmdxNCYiBThMbVbHOwY_hUoLRKqae	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.047
9986271e-a4ca-488f-9253-39c97cecfba3	9eb2a2e7-e59f-4c32-a0ce-f12de2905aff	qr_9HYLA-JnpYgX7DG4LqXY2jM4GKKXLiBl	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.049
c5f94eda-3255-408c-85c8-4da246a20525	e76abfc6-e35b-436b-abaa-4d8dc1dc8ba4	qr_gOZlIMY1lkeDvbs-6JsfMjf1G59AqEcH	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.052
e375bd39-796e-4ba8-ad53-0b5d4acca2b6	2b810c29-48cc-475f-bf82-5f310d3ec470	qr_dQlLg5AxruQe8dmgm7oDGEFjXNlMIm_Q	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.055
857212dd-3ec1-445f-bd1e-ba9c1af0980d	664d644d-c9ca-4c57-b3e7-b8756c78b6a8	qr_VTDwT0_e-iMze2RQddCzA4sy9lsh49rR	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.057
8f82d0e5-c480-4442-9c6a-8eac76523f59	16527729-d286-410d-9c98-946db8fccf20	qr_iYYvVKbf1Cp2W2Otw_ZGc3n6NRz6ICG1	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.06
150d8209-fc31-4bd0-8af3-f1efafb1d884	7ae76a5c-fa81-4f21-b41e-ad4caebba2dd	qr_fvplT_p-NRa4_6G7sVr2wIIhikua1hnY	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.062
eae3d9b5-1e36-4092-a5e3-9844bee75f87	42d33670-6b86-4656-8faa-a4c6561fd03b	qr_AsUH-Pqvy-DO6tmRdG0gwVx4VreLynLO	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.065
0c36d292-8e56-4c2a-b3c5-fd98c7fde087	9e3e40a1-5e48-415a-801f-562e47af85cc	qr_LeO-iSoeM7abG-SagFIsR7ceXzFyIqb5	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.067
9238aaae-5044-46da-b3a9-2f98cf11e3fa	c3a94230-0402-4088-83d2-96d445bd96b2	qr_SRwKDBsKI0AKR0vpngWRpEMX8ak18dmC	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.07
793c4dc1-fbf5-41b9-b20b-052acee9799f	6ca6e479-d168-4864-8461-653fad82732f	qr_dBBCsmifA1WrIptKrFVRYGEMMjXfE4S0	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.072
87da9b4c-c9bb-419d-9a31-1faaf1fd75fc	bd754cd5-71fd-4b19-93c5-1558d1102660	qr_eCL3HuB0ecP7_ZVuLaZEKhYeVys81Nhz	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.074
c0fe4ab4-9a0a-454d-a7ca-9f8fa4532272	c78eea94-395e-4ca3-b0ed-3130952d450c	qr_FRt9O8-o1bHWkx9vYxfGUD9ebqeE11o0	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.076
460ec00c-6f9a-4c33-ad54-2c89b0eca052	a8d59d50-976e-4d0f-a74c-1908381c30e6	qr_xQw8qanTAMhdciegIsoEQ6maF-UWPCys	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.079
b85415c8-3b98-45bd-95d9-ee7f74c1a9cf	3469adb9-a385-44d9-bf72-c874100fdb4e	qr_fN9l2gIVic5ZiaOKi0bAYbkJK8RxQMK2	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.081
6ef0fa61-3122-49d8-b995-e414f5d2e213	c0dcaeec-eb97-4b41-bd4f-d2ae9e8668cf	qr_WH6WeyYCgFhvTTNrPaUZcEM_3GNBgFHQ	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.084
f42f9936-4256-4175-8db9-324a86cc80f3	7cac37a1-a056-4a63-876c-a67e76d602f0	qr_J_x9anMKDssUGqhWriqgmmF81YxKTaQX	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.087
29bbbaf6-cc7f-4786-a8f6-ee89e9d4db22	58cccab8-b0cb-448f-ad88-46929cd69259	qr_zTCMSHoi4brymIM_sMDmPUn770A-3lA2	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.089
c59dfdb0-d8a9-4d3f-b2bf-fb10fdb9a420	73fbcb44-49c8-4aeb-8f1f-ee2ab82b49e1	qr_JxfAvNBCZLccFmHNZdfnCOP_KUKMuN-K	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.091
d065511c-2257-41ab-a681-8d38186af334	77b65b90-ead1-413f-9184-80e98ccd519b	qr_be6PqlBZ_Iz35ePU6ENMK--Ks-o2bEJ8	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.093
18a084d1-0603-48c0-a6ac-5c1c4594bf84	59fdea10-0920-4681-b7ae-83614dcb3e6b	qr_RIFb5TBfWhP2XBdpayQzjuZX6Dj5Ifxe	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.096
7d1c5ddc-646d-438f-a372-62b33cb77de2	d7d0bcb1-41ea-4686-8f5e-cabf9ba90355	qr_lcvnIHd3-LwHdPDTBVvx9lirsiL9k-k0	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.098
3664de27-f032-41ae-bc95-f6c45f8d5c80	e1b4cddc-340a-4cb7-bc1c-6e3d668c6a01	qr_Y2vAyQwSvFT4PfC-s9jD8j3oM53pOwOq	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.1
874c675a-a407-48a0-ac23-57a1f70d8d4f	07869a5c-955c-4fb0-8bfe-e2ad8954f0d5	qr_HC2wNXzl_vz2P4OXns_eYK0EDrfZmHnm	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.103
4911d1e5-75c8-4e43-be9a-ffb3f5cac71b	d6f69e90-9aa9-4bb7-b75f-6007a83a2f51	qr_gHK2dC6LQKwdvAxCNrfHzBIb8_uHFk2A	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.105
42100153-c6fe-4a96-b89e-f337d7f308c5	efb72d5c-766f-45c2-88b7-947d87350e6d	qr_XvHhtqoVB0_TlPJx4OBe25-KJXTrqjjl	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.108
05b9e110-fe65-4c01-976e-94e7e2e2759a	7648f6c7-0f46-447b-b877-3f14ecb2cdea	qr_arrJBgLDAs5hlOK5K5Fcmmsf1RX0z5QN	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.11
a8bc826c-d76b-402e-9510-1c2951c88009	210ef267-62ca-41f1-9848-c055b4b1a396	qr_Nnr1kmAEkBCorJBKL3E1MSojYy1I23zH	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.113
e035ca0d-1d66-4f32-b056-1f242ea7e406	1c0f3be3-345e-4505-aab9-575357d745b0	qr_dnuTNy99OF676HXlw7BQH0KmsVKNTTZh	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.12
94b9145f-13c0-4168-90bc-a1869fc93afa	21a2bd30-744a-4304-9152-1366ed3bff4b	qr_sEVOh5o_3p3_ODAfaQVJczdEUn_o1I04	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.124
c433300e-5c63-4160-a2d7-dbb53b0d6406	b35ec4e7-94a9-4bc0-9ff6-c7a00dbbf9ad	qr_LYzH7AXVHhZD5nKSCJnssVzLStleg_Gj	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.13
b77d7e8b-5b14-4506-abb9-6639448f464d	468f3b8e-803d-4acf-9a68-6a7678684379	qr_nZ5D_fGhb018XYoM8ESfo6ZpStKyINiB	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.133
d1db0785-be15-4c37-b361-141496ad2e69	a4b935e1-bc84-4baf-98f9-b0e6bf547d70	qr_k4T_6c4WClzj0EKhMrXe1w_reuFhmL3I	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.136
74fec710-45c5-4c6c-ad45-366e7b4f5847	842e0a09-3430-485e-a22f-dea16f8133f1	qr_y7mpsGY8RPlc1VnUfpBZ2HeXELvxkn0G	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.139
23d07484-82f6-4408-9e8c-1f20d277ebf1	5cafefcd-09eb-4684-9293-c6e7a0d89330	qr_HGaWhLM7lD5tW4bL7mrZEAK6gUivbVBK	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.142
d531faf7-1227-41e9-8b44-0878b28f063c	1d17a3d6-467e-488c-8023-c184913dbd2b	qr_OW4ICO-JbzVp2dslZXnMcJ8p182uIP6f	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.145
ca6d28e1-87ae-4ccb-becb-551612f63c48	9d05386a-0fb8-4336-88f5-f2f4860d3890	qr_Ej8oLHBe-Z94CeFAheGdo8OpUyvYLwMn	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.149
4f3752a5-d6b2-4846-96e1-b2a8b836e523	95e8dcef-dac3-4521-8f2c-015406f55a76	qr_AupzorRNACdZzZbTvvmRmvRqPJv3Y53M	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.153
0195aef2-6bbd-4284-8b96-f33ae8c26b28	42f17106-f5fa-4d13-b8be-de5ed9aebb7c	qr_98TD8IZhXLHUiU_wKo3U5DD_5gt-h1Ok	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.156
ff8a1498-5be7-4d44-b9e2-55b6efcd89cd	a586490a-006d-4382-97e1-6f8ae7fa99a6	qr_Ps5ZtvKA4QJnAmwAbF5M3NEcfr1XoDis	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.161
4e03be7c-0338-4b53-8588-b07e0d5697a0	24c4ce8a-13e4-4565-aa6a-399048983f26	qr_bLI_4qXIIhtM6Tu_Zq1mRGyKYImRVrha	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.164
b691a092-a631-427e-b965-ba88180fbdad	0cdcc785-c7d0-4173-a42d-7e5b6dcb1211	qr_9ezg5kfOS0QSAaaWMbO_fex7o-w3XEK0	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.168
5757715c-5056-4377-bec3-0c206afb72aa	0a546f08-8ce0-43d7-ad70-8312693a576c	qr_xMAnC9KKIT8ueD-vU9oE4QAbVZmWJf_g	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.171
748176ec-5fcc-4a77-b688-e2d0eb889ae2	07679a5d-f2f5-439a-9fdb-7cf630af6946	qr_SOLJP8U_t32V1omAsSxw0kKHrqFLMGW_	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.174
12d504c2-c3c1-4a45-bbc9-9b9e12e25b9a	0028374d-ac28-4b1a-a26d-f83e28b4913e	qr_oiL_aB0H8zNu2_9Q7quMgvtIFAXoyfFC	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.177
f24a75d6-1b88-4eab-be11-4cf9ed4fd987	908efc85-d759-4e4a-87ed-21045cf969df	qr_88hfbwBBdkDUCZVUyCkpWOIX_XgEDdZg	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.181
afcfd205-3123-4ecc-bfca-f450589b4c43	44fbfb6d-6aab-43fe-b1d9-7277eaf91710	qr_KFTSelr0ireXpU5DOcCrZv0p8KZ46ZPk	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.186
913d4eb1-71d9-4b60-b7b2-9ec8ea834635	63ebc2ff-4d13-494d-a176-36b60882164e	qr_zJlRmVV435tovNKluwWZgFEdJrqlE2qE	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.189
7032e565-e9de-446c-871e-7d3f4c52b151	b0cdb5d9-33a8-4f49-a849-3d3b351d2ce2	qr_TwGQN7h6HIzJ3QoCfLIBRjlT5fGvVS31	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.198
3838a02e-24c3-4667-b257-96adc7d51e4c	ae6f7b38-3cb4-4c3f-a348-173736febf3d	qr_ipOpgve4kdNuymCBnQS8QiE7lOrup9qS	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.202
112431e4-54c7-4839-b64f-9813f87552c1	87e0a025-dd8b-4a63-bd47-c5cb6dc1fafe	qr_H_BBvV83BTbLvGEuH_T5focidTtFizbs	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.208
576c28eb-5094-4814-b59f-d6b483c084fb	f05b8501-1c56-44f7-aa91-a3e323ef552a	qr_oqNVs-NpeLpXVKN1ajkzIVmFQMtG-Xer	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.212
3c800c29-33de-450c-8174-4605faab4a83	bda1b017-79e9-4c1e-85b6-bbbe3844748e	qr_AqSMR__tt4Oxr_MynOFgbKPjpoFHK5rM	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.217
4bfacc1a-fe18-4d86-9570-d094fe68f4e0	6f39eecf-72ad-4b56-91eb-6ea3de4772c0	qr_67nCuLRN3ca71Dgv2MCMDY-HpIUdwW4p	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.221
ec88e6ac-40fd-4109-91d5-b3903f2b69e5	363138c3-7a4a-42d2-8a57-5e6718856869	qr_0vJbyB0v0ZXj-daMGIL9LR3p2ONZFdgK	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.225
57ae9140-f20d-49ce-adcc-cd03552c7fe2	04f1c93c-00fd-47ea-ae7a-7f001ac9c48e	qr__sEShsac1nxJflG9guLZ5Cq_ex99ZxS3	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.229
e7689c7a-7f59-4f11-867e-661bc29743ad	7112a83d-3dce-400f-bb1a-22330afabb31	qr_7Eg7c1Aas96q_kkw3-3KUj-rlGnMrMoC	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.234
c8283f21-fb30-4d97-8c3c-5f3f4631615d	02e51aa3-75bd-4e8d-9e29-287d60cfd695	qr_YyoM9om56VnkjuGcN_tiMb1wBtnWB2UJ	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.239
47bb2d9a-670d-4535-8269-67d0721fce5f	a8ed3fb3-0a9c-4fa0-8a4e-97a1d9501cef	qr_bBiBo-HVSm7C9PTocWwSXZntQlwX1zmR	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.243
3862d49d-538f-4ef3-a951-cd75a3472ab7	3ef0114e-35b8-43f7-ab3b-4d053fd6a6c7	qr_9EkQ5WC0fI9nrAt732jGClMV7MmcjdPt	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.245
90b68149-78fe-468b-8826-43c258358cc9	8bfa5dd9-9a1f-4a56-8a8a-5c7bb24974f0	qr_ESVDjaKexdBhGLV1mioMC3jSC1CiP4Xf	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.248
8ac41914-699b-4deb-8cc1-d7d59fe86ead	aab234bc-daae-49d0-a321-3657f8f0bbf3	qr_a3ftzypZZUc1u-5mCMfSVAG5xg-mTc1p	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.251
2cfb1a37-be6c-4d59-874f-4e16858cbb70	61bb7adf-78fa-4ab6-9bf2-f63c255db985	qr_fRlPaUSrjLP5UALA81RWmgR2Fo8Db6iI	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.254
9eab8f37-c59c-47a4-8d98-310584534f2c	72e3a7f1-7af1-4c5e-80b0-358694b328c7	qr_xSoZe9fjA3wYQeNyQcWST27jS1Lg1tB8	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.257
5f888af7-c698-4b31-8ab5-972afdf49eef	be1c6741-fa39-4539-afd6-ea85bf4b1220	qr_sMOsEyQHDKd8MHo25x5Nx-njjCAt_CkI	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.26
574fc2c5-808a-4287-9ba0-9f7f9ecb991c	e7c20b37-8b50-4122-ac96-ba2ea89d8cfc	qr_Bto7q-nFa5N19tAPtTKJiKnemQnTlkwW	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.264
682122b0-a837-4989-b998-a2f0df135f70	505c9bf0-c796-4e40-b612-bc632b19baee	qr_gkizLlAuYEuE4Mldy2Z-JrTC_ACu_7LY	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.267
9ccf180a-f269-4e34-9877-8dd7f40c28ee	54721717-b8df-4e15-b8fb-708f5b0be1ed	qr_Rs2bv5BGUjZcF9gcuVJbBAn2FK-3vF5o	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.273
29d42280-f555-4af5-89d4-a9a27146a61d	307c366a-41ef-4dae-a1f5-a8d43f6f9ef8	qr_RdvB5YBvFr3Fqae7d_Vq1nxOHkQ2sR4Y	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.276
7534cf6b-c9a6-4b16-b197-9019eded0d31	bac4cb81-20d3-4301-9f0c-99f868c97b11	qr_deUBlLOvSC5jFgVWED58Kqc4DE7K3u3g	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.279
00f660b0-1ae9-4935-b66d-8d42fca077e3	68f233bd-127c-4760-bd8e-f5eaff214f44	qr_WNMlfDSV7yibzWixrWPQ6OWfEv2otbHT	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.283
2e00a72c-5cfa-4081-ad22-153da3be6b73	f7907a21-2d64-4562-8806-d5fe30376574	qr_zMrEXRLzcnfKZDJM2mpWdPBpSvCwh4gT	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.288
a59a2730-e3b6-4eab-8c9a-6a4c14613871	17bee078-703f-4e9f-b717-69c95fd65b85	qr_bVMQ6ogu_1TEsFMCI850f1J900taXlqq	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.293
f01ec9c4-943b-49d9-a212-82aefe5eaf74	a5404b28-d5f1-4d86-86dc-eff26a7c77c0	qr_tD93qqM4QQvcLIcuJwSQ8dvPZATsLXwB	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.298
f9827d2b-6f61-472d-a307-7ce0b8d99790	8d071a5e-007c-4f0a-b5ac-b75dcd93c2f2	qr_C4133uA-PFxbZcwNFWBTdgYYjnv1QKgB	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.304
651a2ab6-f087-4e3a-83e9-e9e19a9dac8f	b923c0e4-6ff0-4687-a99b-3898f339575a	qr_k-_Xp7qtj1EG43pxHa84VFhGYPGKwcrc	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.309
47bb9cd0-f08e-4055-bf91-dc5f352e3cc7	4f5490cb-67cf-412c-8e51-5873adbcd313	qr_ruFGx0HFk1gbt0WKrTbeDy07t7VzlI1l	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.318
fd2d966c-f671-4391-9354-1413f4a1362d	b337face-1306-425f-a05e-0ad1d6f52d47	qr_MOMc0YNtSPq05cmoupT9Jihkbxq-vFlo	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.322
da6ae468-ba89-4e0a-b178-843256c86c96	fb5fddd5-64ac-4f7e-a8fd-9b2c841389ba	qr_aXnfZ1kvgcBq1yHgTfTbaoaCzCbwbVxF	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.327
68513b98-9b9c-4cc5-8cf9-5632ae6e2f8c	39c69fe7-52f3-4c68-b59e-2935c9507967	qr_gYhFaQ_bAyr76WHM4e3Z7qO6eYZn7_fr	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.332
355d76af-5891-4e36-b9e8-73f40c5373d8	7d9743f5-4074-44da-ab6b-98ccefb8a483	qr_HnCo5j7F3e5LmxsE9DihAyDtbvpBHmqz	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.337
9f223644-b14a-4758-a3cf-b88bb2a27bc0	8bc77696-eabe-4378-82c0-62b08143483f	qr_MJtJbfsCrQqti-6NHBYzTFm6cx7K5KSj	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.341
1ac2fe73-164d-4821-b9ac-cb8f3d0b4127	24bc5851-32f3-4b99-b221-6e51a3fb7c5e	qr_bVMO5VUOTrA4h13bd8jyotei1L-fuJwZ	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.344
7676199f-590a-4620-a171-ca513d85023e	9a64c953-1c87-4298-9e8b-7e7b2cba3154	qr_yfy_3Dzy1LO5bOC1LveSDRiKyjSFY1A3	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.348
8385c19a-d4fc-4bc4-95f4-76c83e1a15fa	6d07bdc5-8084-4f86-ae8f-883cd72a8cdb	qr_wUOnwpM-z2WHwM7fYdaldtNOYxrdJtMg	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.351
29c96d7e-eb48-4768-bf6f-ac469c371965	69b3c4fb-c05d-40fd-87dc-596d9c102b26	qr_xJnSa767ipYLZpbJJXWklnQ8nnm7mcL0	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.354
a3e354c1-39fa-4025-89d4-c78389ad9a14	012cc349-b2fc-4822-b419-36f7c84f9132	qr_hQ_uk0hupIGBsPVpopb7ezGNdVopeedz	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.357
5480455e-a30f-4394-84ab-c3b84ffbbafc	7ba4e063-2a7b-41d3-8f19-d75f6c5dfe31	qr_NbP-im7hVMEzH5cEbLP0_aumGlZclJxD	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.36
fb651356-0e08-4c75-ae6a-5a93f0982d9b	e355c8ef-150c-4afc-a0ca-5d4825af534d	qr_G8gfDIr6IOqKnJCnEorsawAVXL48r73H	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.363
b794581f-bb75-4b2f-9759-d7486a1e0360	06c52bcc-df4c-4ecc-9f54-5841a692498f	qr_k1PYW6dVRLl8kbt_XYnQWpVjwvImziET	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.367
21d57349-4d58-44e0-a2c3-72ce9708569b	29b58cae-7144-41c9-b6e9-9a69e5dcbe5e	qr_MyfbyQQpwhFLmW2yBWcjcbwA77l6t9xI	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.369
74fc626e-9e16-443b-8c09-e5a57cca870a	3d23c389-176b-4c67-977c-40742cab749b	qr_izFEIoe5ZRBXH5jWtThSLBw7HehQO0uc	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.373
f7c34483-74a0-4ebe-84be-e8689cd3fda6	b37f7520-f4f9-4aee-9a4b-f5563ee973c4	qr_dBiL9p7NEFPOj1XCZ-x-GopYVJdhudJh	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.379
c54a59be-78d6-4ff5-8eb5-4f535c4696cd	4f377db8-135b-4a7c-81ed-d62e94c54e77	qr_L0pI2_VvNenEVhZqdtzbo1CQg7Esv0yJ	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.386
912dc406-e968-41b3-a652-a0e086f98029	06f5e627-8d29-4d6d-af2e-e4103809f445	qr_Hh4m0k2YYAWnX20UZXxPxoyPBNbgCKjk	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.389
2940d76d-3e27-46b2-81f6-2d10b8e12d88	2d2454e0-ae9f-4eaa-ad90-4ee14984b668	qr_0M-XUw7grm7Bqt0ZkB1p9SeuF24k-xae	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.393
79fd5e58-2c93-4b20-a2a1-9535d006f132	1cdd35dc-44fd-4187-898b-12482a58d764	qr_ikh95f3E6zURFdqQXDsjlVOMeIW_QKm4	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.397
0e7d3221-b05a-4ae9-81b2-9c3e12c93155	b8c44cbb-d893-4d71-8127-7fc9c27d33cb	qr_9ykkz7_cajdGi1d6XJSQt1aG7ycnAR-8	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.402
148155ec-49a6-458a-acf1-a25cb60b886a	7ff24735-0e3b-453d-8257-b161789c8d54	qr_47NNkBlqpJt1Ix8xkakFR_K3LfXmTEbp	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.405
06dd3b95-6837-43e2-acf6-2c1bdace948d	52be4ecc-38a7-4f7e-be5a-42795e22f95f	qr_yaF7UzwqqVD9zLIvRCAKXXpXqgNzB_dU	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.411
b71a3722-c0f7-4c2a-b945-3bb6256a7d91	591e7d4c-64d5-4554-8d34-cfbc93622a7c	qr_0UNobl2NdofDMkKxJhYvFG6FSqhLE5dM	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.415
9d2ea3fd-7880-4729-9a0e-f2ff6d00d8cd	f0c86d64-aa11-4fd8-96a2-319a58a26128	qr_MyhrfrSE_VNEW19vnCKLSs9hyioYt2Ku	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.419
12593dd6-bd9b-4cb8-bbcf-4e896dc9c1cf	4ab150fa-bbf1-46d6-bca4-2274defd1aed	qr_Ow6fdnusI_1kNKSnBojjXUkIKZtEyTri	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.427
0942a239-7228-4764-a334-ca4eaf335cff	231fd348-cafc-4c0c-b6f9-9b2b83ff7ca8	qr_6aJP4kDwkORoQntsa3Jhf3TBZ574Bdpb	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.43
84303a9e-276f-4126-a9ae-79cd931af99a	f5e68653-1281-44e8-9a35-f40f9fff42f4	qr_l8r61246Zn2EdWnIL70c7RnXWuuXaNNQ	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.432
8c72b8df-2a5a-4bcd-9be3-864387221c22	e5b2ea54-5acc-4d27-8a64-29c5f8d778f4	qr_1vUulYug4QA2tRDz2SYCtZtuju4PrIIg	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.434
62a785ee-bbfe-4640-beca-352483ce740f	c27f352d-7738-49da-8313-877351b22ad4	qr_4m_DYGLx0HZWW0BminUUFW8rQdP__L6V	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.436
0a3c7c65-c815-46b5-a449-29d82ca9c633	4982edbf-0548-4453-8b0e-2df927577213	qr_MpUiWRsQ_RLDgt2UbLsaf9Rh6fxivz49	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.44
0b027991-ae8c-4b0a-8227-b114d8b55573	b310b4fe-c9bc-4c88-b230-f57ba3c4bede	qr_LfrV0KZTuRK5IaM-_1Rdc9vfFAO80NUL	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.443
ab662462-5f7e-4c46-b938-1637ef1671ee	b636a416-71f5-4b29-8072-7120b574cad0	qr_iOxq43OFDwNElT0xY3Ij-ET0mIYmCDFC	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.446
d174fee2-37c1-4d5f-97cd-ee278436263d	86172170-ea4a-4217-8600-eaed32775506	qr_jPK3mfta9WxYPdVxFZ0qviBardPqnAk4	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.448
50c113ae-084f-43f9-9779-30217eb93f9e	8342fda5-a147-4cb2-928f-1cb268f2f6d8	qr_rD8aEdu4xl85XdHda4lr75KfLLeIkPBy	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.45
42f9aa2f-97c3-42ea-a811-8cbea7ec0796	5c411562-30d2-481c-866a-70fdaa8c1824	qr_nqMXxR6s6xuhJeejWksxP6AwKBKMLz7R	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.452
e30c113e-b0d3-4cb0-b642-e1ddad52825e	0751af89-9384-49fd-9e85-be9e2f7c3607	qr_Zz5oB8zAiViDXLHI_N0pE_VqREohKghv	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.455
a2e93a82-61eb-4c9c-b9f1-8302bcef49d1	196b2727-c418-4538-8487-ae2d85ba96e3	qr_zImWd8qb9UxGDv29esnuU4ieW-s42nCJ	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.457
abb4cc60-5190-432c-bf77-d02a0f9c10e5	6a8a563c-f6b4-4901-a9b2-11d811a119b9	qr_ZZHKsS1qDhGS0gj87QvFhcrE0M4-pDC5	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.459
f570a67c-c4ec-4784-b983-bc7bade261d3	542d85a0-42ac-407b-a3ec-0e1baf64afca	qr_TI3X5m5EygMmJ-1WFEGVtAdFo24uw4uq	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.461
dce906d4-f2ee-4a0e-9efd-4ac5b66a90c4	5385c113-aa49-4835-876c-ae2b2daba6af	qr_yTkYwtURH4SywNESgJoKwr3j9jcvFj7s	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.463
06c0c731-ba96-4b4e-9d71-4be454c5bd45	fcd2bb03-5fee-450d-8de7-ebdb8adca311	qr_MtCifCXXkV0TSA3As2o8xq8n7kYXNJyT	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.466
40270c8a-4c14-4d6d-8c48-621e47d8bf9f	dd77d02f-fe28-4671-b198-45afd65b13f8	qr_n0IQ0c6zhP2Aoict1KF_iKlcrT3BonxS	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.468
a6863a8f-7ffe-4702-90f3-5ba4b634492c	2d9656df-e605-4cc7-8d80-c1f27f16869c	qr_L-1MmGGxvg_MYPAL4UlxwFN3UmezORym	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.47
0ce0550b-5217-49aa-a570-48472427a917	dd51884a-dfe8-40ad-a14d-1d1a02900912	qr_JhVIa_RcOVQNTdJ2OcczXgClSy88qyYC	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.473
f6c4495c-a9b7-40cf-8b4e-65fe9249d412	e1a7eeef-d8a9-4792-8019-4d714cb4c7d0	qr_8F-cHectTa-GdpGtwmQaFVK7IORq-Tky	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.475
d52de42a-8e64-4057-a1e8-698ff86af78e	5891fedb-2152-4a93-867e-8dcc6d003723	qr_VN8ccD__g-KUJ_W0uSI8CUzRF7_FgAx-	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.478
0247ed3e-5847-4fe4-bd2c-1cc228219054	eff653d6-4383-414f-991f-3b1bbc064992	qr_Y5rnqu79bxrtRopA_WIMTey5ZmyW3l8R	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.48
5a9cbd14-10f8-4e0d-a7c0-012b771308a7	1535947b-672b-4d53-b51a-985714e1e1dc	qr_jh1e0IBI3Xbj99eFORZpUNH4jL9DRVsG	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.483
828b7e6b-c68e-4f47-b883-5afffd815d91	488c36a7-a114-4666-bf0b-88078624ebca	qr_6iT5_B_oqbhSJODxax4OfW9V1zV5Zfqg	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.485
655f10c8-2375-4c22-931d-3773b8ac03d0	e8b1091d-ed19-4189-896b-742a96743d77	qr_JDr-tFQZM2K3i14O48VCvq9OcjrrPUE8	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.488
62ef4df9-b701-459b-859d-315c9b0f48fe	0bf43e2f-5ab0-4b7a-8858-4ef8ccfbe7cc	qr_sJD1qp9QKkgkciUX3MA9IbvDNmvz2t7d	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.49
ddbbe7aa-2919-4a6a-8fc9-6c6f1b1fa20d	4dcc34db-64ae-446d-9a65-5a949b566304	qr_5sz1qGfoC1ktEsvVc4OnOG3DYnx1WIuk	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.493
3b3d859f-22fe-459d-808e-74a2ac397b4d	67786e30-a58d-47d0-8985-94940018c06b	qr_50DX9a5KKQ7tEUzRoqRXZKFsuqpC6jLl	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.495
930d9326-bf2a-4371-ae03-eb805b97e0c1	5626a783-15bc-4f9e-9e92-e7aa26b29683	qr_LtjfTAO91fq_CuJf2d4o9x6YJWA2hFBF	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.498
b055bbd6-49c7-42e5-8a35-44220c7f2c9e	f7a502cd-3f33-4ce6-8bf4-d65fbb6575fc	qr_JEetSg3HtWhBwL9-kI1n-qeDtOd0WbzK	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.5
7c45d092-1654-4a3c-9448-d1186e166083	e198b8f1-540c-4888-a500-694c5b4cc117	qr_FtjEwR7ySRu3Ct6aVL7gePwKa9K6EyHZ	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.503
d0323fd2-b367-4f3b-a978-a89497d47a21	bf32f511-db93-49d3-b927-8775dd9d8ea4	qr_6bjwBbHsNAoQ1kSSubDf9KSnh2vKx1V5	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.505
b79e3cda-3a8b-4ef6-9f6c-e5afa4e0e6ff	47ad7cee-91e6-4d25-8844-54506f964c03	qr_yZqOU964FAnVnrYLEjKCVB84f9UeqRmk	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.507
a11ab159-116b-4ac5-845e-70440399be41	1473f56f-6b88-493d-9397-6ad02d09f501	qr_u7nebCq0s9A4DatZQZuF85zqK7M2G66d	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.51
3453cf97-cb17-42e5-9efa-f42437224321	8b8254e1-5e9b-410d-bb94-bde83b83127c	qr_plOKB9CjZ7MWbk3YJLTaOgfwae2FVgxx	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.512
06e0e3be-a107-45ad-b61c-a79392839653	0ee83df0-3013-45ac-99de-5a3aa44b5f20	qr_5TQjKln4oODEo6I1xafKra7kQZlVTx0S	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.515
8b15aefc-760c-47d1-a74c-35c74966c392	f2ffa8db-cd38-45ed-804c-25ff73604e06	qr_Z8GN25I93H1uJAivrkQFAID4Cz6C6i2z	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.517
ac8b259f-ba24-435a-8fb2-3b944a35718c	05d0660a-20c6-4d8f-8020-8f786105e652	qr_1G9YvLS80j4CFHJ1lOwTOy0bFwMjoE7I	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.52
36f35f43-3f80-4b65-b81b-794d9ebcaa4f	4fb7e13f-cbc9-4bd6-aed7-0efbbe5b467f	qr_aX3tsbMwgk2TtwAc7X-1jdhC607PjKhK	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.523
9f6cc3d8-e31b-45e3-a194-44e30e40021d	5cb1dac0-56ff-4c7a-be8a-2178365d36af	qr_EZc4rio4ITIRe4Y33sSVESgr3fjAMQ9h	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.526
33ed04f1-e4bc-4a53-90a8-b9c8c23038ed	b77ef299-8d35-4237-83b0-6c1b65e2d205	qr_prF-CafD5WNQXOkgVI2BCMzE8S6knWep	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.528
ed36ba62-05de-4955-970d-a90206d3f520	57526353-e3cb-43c3-a9be-d4fdfc1d4b1e	qr_eaFA4aPOfeGIEVN7QYekSDBkXWRo8bD3	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.531
dff0db6f-5d49-4121-a75a-f142744d3dd8	edbae7bc-b600-4c51-b228-ec9677d78565	qr_oDRjlpP64Zh9SWLGKw78NgXmeV4NMRqi	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.534
4072b106-dcc8-443e-99ac-a3d8049ab3b8	2d313bb1-5df0-4798-a93a-5d7808efac6a	qr_jarPTXwKcbtHMk-gjuq3WNKLapKuGpiE	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.536
3c1ce401-95d8-4bf9-9b6c-40e3e36b3da9	d4aaa83b-9ec1-4435-a52e-557c91fbfede	qr_KXOGgEMiMePj-9UkzdRrr9BnFEY-HwOp	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.538
37d7776c-9345-40bb-8299-a92de0e6b719	7863920c-c52a-4145-bac1-cbee7773aee7	qr_B-I5CuI8VJpAeefrn64IDhYNZKqw_tUt	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.541
4def5ec7-f711-44dc-8c73-7d157130e4cf	c6c277b9-9a8d-4156-a580-5c73a9f9143f	qr_UQ9f473HJ5HIviauwhD3rGApHf_JodUM	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.543
b58d7c08-85d2-4438-b291-9c919b7735d4	19b12400-6857-4cd1-b531-0a359425d793	qr_n7HpHyXr6mm2bQXZajKXt61jBEQ-ade8	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.545
a6a201a8-42bc-45b2-9d04-14000b6c9cfc	9377b43f-846b-4c43-b416-fba0163e8a1e	qr_5hjVT5je7XkySQT2yAz_O_-PNF5E4MIF	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.548
c2ff4684-f9db-4ed4-9ab8-55322803b6aa	0d36ca84-1828-4307-805c-f62c12d6f88a	qr_illklABaBOwqBVRKoW6g6RlzXEhNQMOv	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.55
686ae361-75bf-4c5b-9a28-83133880fca0	7d88b71e-daa8-4ed3-aa3e-2cbcfc42186c	qr_N0N7pzFrWdUjMxfBrhocgNly9hCsnBt3	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.553
e65001ed-b54f-44a2-a02b-e727bd8493cc	d561f381-da71-4add-9754-38d7274c4640	qr_cWgY8Qvb3aCDDJ3Fqjih3yUCvjEjOaBm	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.555
0ab748f7-c29a-4cac-be14-bd888b8fe7d1	69588e42-1922-4d25-8b57-87f26061b2f4	qr_JueJnv89tRTmgRwiQNnG5L8dHKrpwVX5	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.558
512e3827-9847-495f-987d-e58fffd1482c	2551524c-c0c7-4cdb-8791-b131960bb78f	qr_KdVwjGWLtt27Fvznmg9v-UV_mwRF0IJ_	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.56
e6431df3-2afe-4699-8e87-ff7259bffef4	45c46aa1-94fe-4ee7-a217-a40d62a46ee3	qr_WHRTd0W44_1_w4q4mirMRfYgwXVMpcAN	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.563
c96de839-1a02-4d8e-a540-4779cf2fca55	1f08e179-5472-4dfd-894f-0d4ad62d3049	qr_OYNeBODBd2V23PRF66jjW9L-YjaSQ0cS	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.565
156b8524-950b-4d27-88e8-0b8fab523220	c8a6b363-beaf-4fc3-b196-ce189955e99f	qr_4sHYAEvLv9XcuJKJX1n6FnPkhWnW-Bnn	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.568
674a4302-4cf7-4613-9d53-7c9043e58eb4	a2921b16-78a0-4430-9d59-601301c47f3f	qr_KLpfcDBD23DDzBWPDJBWgUGIMg1HmeyH	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.57
770b6a92-36f7-4e5d-8ab5-9811359dff50	74d6fe6b-b52b-40cb-bc36-7ee9bcea0d65	qr_SyqVfw7qMxhgZ7Z_3DGk0-o1H-2Qmi-U	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.572
91066d61-7789-40d9-9a71-0bd1512e52fd	58996bac-a96b-4670-a7ec-0a71aa57de1c	qr_C81b8W9oC8BMqt9tq2S---NzGdw-BK_j	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.575
894c60e4-d941-448d-b8c8-b5fc6609b099	b856be16-f83d-4cf8-9751-3c2413f677e3	qr_XN1FFQH_1DlOPvnk-XLeGuGnEW0rLLMo	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.577
233fe2d9-37d0-4d0d-8baf-2458415624ec	b9f66c33-c87d-4442-b9ff-bf453911192c	qr_nYxzqB325wdjyrRboU_lR9qnS_6mniqR	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.579
d3db8003-e38d-4ac0-a17e-caf68f8ac6ee	ccbc31ef-2996-436f-b4f0-f89cb8be4eec	qr_lkxnQ1n2oLbpYbefSARFeQl1ROdJp6RT	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.582
a1f947bd-f55d-4352-8dc9-95bbadcd039f	45edecc3-8af2-480d-8f8d-409efa9af45c	qr_1G-ZwowpncZv_aQcWDBa5a5dCuz93nfn	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.585
c50caf63-c4ad-4395-8dda-4ae6e23104dc	3c356089-8431-4e76-bdbc-77726631ba4a	qr_cV7VK1WJNzhrW6TXEn1tmroZSf3euksz	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.587
ca1e656c-1623-4b20-8242-8c4abdeae655	bec44d33-9aa2-4745-afe6-fb6488590874	qr_xzE5Hfh_ix2r-gEkFgv-PVA2mEL046d8	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.59
c272efc2-fa49-4b68-9119-066315b4f896	23d82a8b-17c9-4e1d-96a1-4a1367fab702	qr_0D_iTDJQ0trPPiVNbz9VpZCtRfj4DT3G	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.593
01c9379b-866a-4351-9c88-2b12f693260c	25b58b88-b9f1-4d9d-8e01-281e2878635a	qr_BxEMCqE3fNGtMm2CY_uiU2uh1_wInrgv	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.596
6914bcb7-7916-4273-9642-4e7246e64158	78637917-13a5-4622-a891-ff83d225008b	qr_0ncE12zi8gThQqQ6op-EYC1hOPpVu_xT	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.599
04e852e7-d99a-4013-b74a-2c7fb17ca390	82ec7b25-4ee2-48c6-90e3-6f3666456c28	qr_cL6xCSHddLdbi2put8vU5X1Em362MLab	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.602
948a1b66-4011-480c-93db-2be93f875019	b579dfd2-b491-4231-9b39-68d6ea492330	qr_2DxTqffzHwccJZ2oQVt1cHBPvki3G6D3	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.608
43a302ce-9b6e-437a-81d8-1cc588868fe2	aea153ec-2bc6-464e-9ece-84f38374c75e	qr_kI28IQRraAQABofT9GLDY5-t5na-d2Ns	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.614
03a119e2-0699-4ebd-bcb6-f627d243c1d2	9b48a04c-5604-40d4-84df-05593a4a6ced	qr_ebDSwrkyeq1hQ8EkUlmprvI5j2une5Zd	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.621
0130e834-0e16-4cd2-9e6f-fd93120f4557	2c6846db-e774-4c4c-a2e9-2141ff704bf3	qr_PNFPiqzR145AfEgp6B8LArHN75oXE1yB	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.629
60cbd671-fbf5-4ee3-9b37-a7a446e870c5	d72553a5-d42b-42d5-86d8-6a1cf3308e02	qr_Ks0nBFI1i7D5nHtwv-fMhAerIjG6hd9e	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.634
9ccccc3b-d21f-4be2-8098-66dd7d046e01	b674f00f-b2f3-4069-8c27-823ab78cad06	qr_08VONFzn8NbJke_2driX3gk584bWi9qI	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.641
cc9e107e-dd19-4031-b753-3a85f82cc5f2	570e09e5-5bfd-4f57-bfe5-53c6f3f75ab6	qr__D5_29js4JeDT-MP0xOTVCIiRFTszMGa	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.646
62c5bb39-4d80-4f63-bf8e-9ec72187c792	13cebd29-71a1-4777-bc90-345faea37ae1	qr_gfLXTl7nu34OZtSwCBj5hif81TBZ2KnE	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.651
133b13ce-a7d8-44b5-90e2-939da237c661	55ce78b4-59fd-4039-baa6-ccca23e07293	qr_J9XgU4DansqZu8lESt8vyTdSIp6Yroi7	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.654
5ab3867a-1689-4b3a-88ee-1f5d739ef7b3	7540c041-9b1a-46ab-bc5b-ef51f8ad967b	qr_2TE77u3WDiKHJ8HHUFfJKyszbEsL6vJw	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.659
bad6b4b5-ec4d-4095-8d5d-ec1001e8b4b6	3a9af331-dc25-43e2-8872-15d71239d18d	qr_wr7Dp4NodXomyOKpIPMhzUulpMjNle6t	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.662
8a042c67-64a2-49e3-86ab-d0361af5d9d0	4392fe2d-ed36-4440-89b2-a8a07c89c900	qr_LW3dDkFMeeisXDpZKpePSU1bEDEswPT_	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.665
2e133ef5-fe39-4dd5-94da-1f0ffc119179	11d3c191-908b-48b4-9aca-f3a024eb3bff	qr_iPH3T7TAIDCp9v59B3wHxnq3bSJSK7G0	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.668
52338e45-7a21-4dc4-8e44-8e7684b4a66f	18581649-b37a-4166-89b5-56278448aae3	qr_lOKnnr8CsSQocz9H4IeMIGcwf6syX7GZ	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.672
186ac054-28e5-4638-aa60-82e27e2c0c6c	72351dca-0bdb-43c7-a49e-71dcbd1fee89	qr_vwdcLvYis9ojTMn-eAo11NJ9KMO1U9Ie	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.675
43f86d57-9e77-4d97-ae29-1beca8d923a6	51b5d6a3-5b50-440d-8338-f49d182b75d7	qr_4pIBI-5EFjmg9V_2Of03P7GXvDKDR1Sd	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.679
e02a4931-0652-4f34-b852-d0c4d74a6829	bb89b5fb-30d5-42ce-b32f-ac461dbddd60	qr_9_GhofMEMByRqgNjYS2MFUknUbHeVKK0	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.681
9bea8edf-598b-4da5-a656-265a68c92b24	5388e3d9-2cab-49f8-befe-077be42f4b6b	qr_ftcY5X90FBs9WTio7H_2o9XP85mwMHMt	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.685
2c9192eb-67fc-4439-891a-bc2772406d3a	9ffede72-a098-4264-b490-ba65abd778e2	qr_KzbJ1zyKIv5dFhxpKgavmiwHBTroRTpS	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.688
7a472dc3-07cc-43e6-a423-1610ef095583	8f6cce71-d71a-47b1-a9db-1b4c72bd4164	qr_UJ8i_84vB15k0WahriXzGr_K7VFcoaXg	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.69
071b4a04-9154-4787-ad7d-e2ac9c63a233	d703acd2-0fbe-4c32-a177-75a6923f48c9	qr__1y94K1npgF5HbyBq1PXStFrui3H0m-0	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.694
4b9bbaeb-6ff4-4c42-b1b2-6c74734349f1	d0937df2-a06a-4e4c-8358-5a23159c7d10	qr_H_bKpHUEB9hDMfZZj9e6ZiZbJWWr9KrH	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.696
12d084df-e9d7-4507-93dd-845cdbfc4fab	876f1106-6cfb-426d-9385-0b8620f510b4	qr_uFedczhJEP0U3PRkq9NhI9ciC4WdfVLx	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.7
5c60e27f-3b99-42f1-8e82-6e277e20f1e0	caa5c4f3-09a9-41f8-8cc0-0c49059eb883	qr_MrAMS1suxdbsbSJCU_t8KvlF93VmrDQK	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.704
00436fd2-118a-495c-912d-21e9eeb1b816	8f457301-777e-4e46-bb16-9e513d503b8f	qr_NCgP7FR-9SdgdPf4a0Tk4pwk7VBoW3Kp	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.708
fef5edd3-6d9a-4c3a-b570-8d0e938e0cff	951fe6b5-c0ee-4f67-b56d-04e9dab757e1	qr_OOoH_iC0FWInHwPthAo13SbzA5AoFIoQ	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.71
d515f01e-7ff3-41aa-8143-187ba4db8838	2f700487-3647-4b74-bf43-b0c9e4fa1392	qr_H6s76ym4hNGJBhN31KdC2Dohx_ATpDbO	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.714
0008ae36-3899-4738-8738-da54f450b557	fc86659a-bf9b-4b0b-96b1-bef3d385c0b1	qr_FCSPKA1kaPVJZql8OHFAVbx71sQ9ZU5v	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.716
75288515-95b2-41aa-b1ee-de274a9fc13f	e858710e-c6bc-4393-ad64-55802e1fa3bc	qr_73T8hlSxfS2wx67nNYPQ9RcLV5AmlUrh	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.723
0ad90091-f9fd-48d8-a1ba-79de47d4477e	d962e466-a8ff-4a9a-9288-7f0be3955408	qr_n6WkRw0Va8yZWyU6YdMWmFjEEo5fSbJQ	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.727
80c9c817-a301-4b08-a5d6-693e1841c842	5e886801-1477-4204-aa25-9b41fdaffba5	qr_B82Z2AGtZoAe8yLs04ZvwUKHqUIJ9dNP	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.731
c5aa3364-570e-4057-baf4-0741de2d5ced	f9dc580f-def6-4737-ab7a-e4dc8ab0205a	qr_iZSeRfo3CZlEGxmdo_4wZolEzjbCRRdP	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.736
9ffed38f-cd4d-4c1f-b4fd-6064e8d9bd42	b269b39b-9fdb-44d1-a42b-c07620b42e3c	qr_vX90Z-_0vRnwiRhlXExoZRvRITh7kF9i	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.74
b185ce81-5fbe-450e-b393-9d7f257fe457	efdaa985-50e6-46e4-ad2c-555f575fbd93	qr_2W-QDsjNBwWD60VIvMTTbX4DgvB_szWr	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.744
beb92abc-3ab7-472d-a4a0-15bd098734ee	31523151-aae8-4f0d-8095-54803334de83	qr_DCc6xDvIONtC3uzN1rx6KxVIYrIn5puS	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.747
21092a65-5cb2-4ea9-b114-b4f43ce5e9ed	5e9823ef-b025-469b-943d-b6e54e923f35	qr_UDsCNqrVB1GPYUVqxwo6WI9RezUDZ8vB	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.75
c0b9c838-4a17-49e8-a378-fe2f882c6541	2e33c729-e464-470e-8c1a-2a2d76c4adba	qr_AH8tE9ZQfijCNhomqC4KoZ32CuIb1lOX	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.754
fc78119d-6a0c-4230-8a76-065a1708c43f	c7514e5e-7816-4df5-97ac-89e47be6afad	qr_3SZCzVf0DVQXFA_DgNGUAXPBrGsWuBGy	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.757
e81e941b-00d0-4c1f-9671-22bb500fd48d	34e91cad-c7b4-4d8c-be5b-77ebd80eea91	qr_qZZkkMErA3pm70Isxza9gEgaRtYjjgNM	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.76
5b885af8-5349-430d-be3b-0b0394a4bec3	606898f6-0689-4922-a723-d220846b3d71	qr_nMue1z6o_o2D1MGlnhGrBAzFX9HIoKAa	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.764
98e985d4-f34a-412f-af67-76e3a6aede3b	93a081ad-34dc-4c22-8742-4e1ac648dedc	qr_H97lWzGQElFUTcymL9TrK1qSGrf5I2kd	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.767
6795dc00-b82b-4ca1-ab80-070bf6f123c7	d77f7511-00a6-4b37-b70e-31bc531dc7be	qr_cNiTyoEoE8UU-U5sdbA9NhnNCqFONdXs	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.77
76ffa62b-9d85-40d2-bdd4-60685d1d243a	547ffaf3-5aea-48c6-b7ef-ad32b7007059	qr_GRCDRSutrn3dzOOW7SQYy15n2iDGxVhN	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.773
9b432b6b-ee00-4e72-b2c9-5c2e5e25a89d	3b4d1df2-847f-4742-a33b-698af90ce51f	qr_wBmQ3wiQkuIZQpA19bWRP0vtYoGtNilt	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.776
6ace952b-f19b-44a5-a967-33f3fad35b52	89013cc2-fd79-43a4-877e-97b2a80d78ab	qr_aeiUt2kXWxCYLgvLDE_TxyRIJ4KYu4ne	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.78
5cfeba60-14ea-41c2-bde3-ade08a93e6e7	7d505237-c843-443a-bbc9-b6fd1667b0ec	qr_QDKOiKDbpVeuxXH8mk3W4HIVst-Nbpby	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.784
31027ebd-02db-4600-b19c-f2228b9c1883	f203d07d-142a-4ad3-8cdc-8b8ed01f37e2	qr_MiiOcI3eOK5fEITV0ADYj9w3mtJ-Vsse	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.788
4e249cd5-a157-4e55-a848-12b2b0442ee2	efd89118-dfad-4cbd-9e82-0200b03e81bc	qr_3xlGsUF_OIIU8Xj0R3OJw1QpQtU3Avg9	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.792
ab307602-156d-4a14-b9f5-c48468fc0afd	1d066434-c12f-48b6-af88-5180a70dc6bc	qr_om0ZearGzAM89X1WOuEN7ugtBVO2wG5H	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.797
69d227fa-d5fc-4876-a927-cda6311a0d40	4b4c1951-d6b7-4bc0-a2fa-c0293f32e9b9	qr_xQWMWZ3Dvw8dGlsKOBihWVVsrpT_AzRi	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.802
840e1c23-58f1-4068-874e-fa02a2876541	ad1a82b8-1b60-4cfb-a3f6-64f9b2234def	qr_YqZw-FfwpRz1AQexaQRCg-QRWEZbAELZ	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.806
7e358cc7-0d3f-468a-a300-f2df60480484	49e286c3-d440-4590-ba9d-604b1ca579ff	qr_8H-dmT1ga8H0wIsLDKG1uySJw0w5Pzxf	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.811
e456bd44-15f9-4a82-8fe3-b568902cba76	784937f0-0562-481c-b6c7-d2f71d82a29d	qr_Up6ObsyGMP3d6wLnIwwYi7fzozMN6-5W	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.815
cfc88884-626e-4778-900a-c2ca648b23e9	7e3ad3dd-ccea-4b5d-9bce-fe208bc1f22b	qr_IvshWa-xOrkX2XBigCmCg6JYcEZVY3eF	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.82
41c46eda-bfe7-4352-81bf-5b06abee8283	bc9dd19f-183e-436e-81bf-4e8742c56c8c	qr_XEsapuP1r5FSt6DPn5AyKHt9mMK-0-Mq	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.824
da1e66dc-741b-4de2-a3f5-7d73d20c0a12	fa04a1fa-53f3-48be-a18c-80f70dd0d222	qr_j10p2voyFcnZyh7exmf3OjTy4s-yfX73	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.829
d4e39f07-1cb0-4e0d-97ab-75f87cc26e33	f31eea6c-7784-4ef9-b177-ba6d2c9e9b4d	qr_ZbHtyg4kpeqw3kPUJsYhffTCtwxud7O4	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.833
041cebf2-fdb0-4203-990d-a4861c6dd79a	dd5f1434-c289-4193-bf43-a205467559a7	qr_uPa9eltLKaLDGjBqiQVqAXBEM090nFdS	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.838
a502cc89-ef44-4b6c-9bdf-eeae4e30317e	d2fd5ade-27e2-4c8f-a640-a09d0317d6ab	qr_MQyvVuRDRpBs0K4AVy_d5Wj-uQIm0-jW	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.843
db866607-e4ec-4a6b-8f6b-83db1a7fe733	304fb205-8a9d-4956-8be4-98827a064211	qr_J3oQooIa-ep4Md8_3BCuswlOZHup9hQo	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.854
d7b36b16-3ec8-4539-83b4-43038e7635ee	4af7354c-579a-457d-9bdb-061e05f88d89	qr_OtprBBS9Wxcr4vWKQg_KZQFNaC7jP3kJ	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.866
4f8aff12-8274-4751-bdc1-7445b500816e	784d64ec-16d4-4765-a996-b4f1c8dc470b	qr_DxC_dudGXejIzoBDxZw1QZZNPiDohv-L	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.871
437f1253-77cf-4d7d-bff0-4e6442960bf3	aadd1fad-0205-4958-b475-4d69402e3527	qr_Y_g9v7pXSe7FIoqhUP8q9c3vMRG9F2CY	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.876
e29ab07c-49dc-4d45-9bc4-1f5a5097037e	95fa6717-7431-4e13-8899-71c4eba8b31c	qr_D7ks-3wAxIdmRBoB85pVL1-QkKCaoy_a	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.88
e8456324-5544-4d98-a45c-1cbc495d3d0a	fd79bd13-66f8-47fd-ae2f-495db9072fb4	qr_zWDAe1UtyDYnGSntvOtf1rEdDE-OGZHx	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.884
9b87b5eb-130d-4ed5-a524-1bc82d4f257d	fe544783-e1cf-4a56-b323-56c0814c3f57	qr_rzbigRdI7yimTYKnx8pjphZGWwqt4T0T	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.888
da9b6baf-736d-47d7-9034-b0450fca0665	4068e93c-32de-4071-828a-d536e0d14285	qr_aasx4XWWh93uhXOPVQO8XmuuNCtZ1qhy	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.891
6d00fd4e-0180-42a5-b2c1-540618fdee42	2f7cbbc9-b688-42ca-a513-d3a87558d3e3	qr_iAhn15BkU9u-JSJK4Ng0pQVFSNF9clO9	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.894
beba2c1a-0a62-4d44-84b1-0c5cbcdd0d5e	c2e6053a-6a59-4afc-8637-c0dcf80e6573	qr_I5EX01KGmxQ5z0Nvp9nYB7elFghcnZMw	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.897
c0ef5922-2cf4-49f1-9991-aaeff238b154	1415474c-466e-468c-94ef-aee68c31766a	qr_WdJypKAvMIyFVRFSc3MOI_Dy95SzjyZn	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.901
89887908-5d58-4a6b-96eb-6cbb7b6bf7b8	4641446f-1149-4a57-a669-7287f119dd8a	qr_6Uwwegux7rIuE2sQVewK2o9be4SqRgt6	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.904
fed29f66-76f5-4649-8ff8-604d698be301	759f20ef-2b57-45a0-b056-cb94ab14ed45	qr_i5sQz20TflpstyySa_vvl1cUOKxxgygZ	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.907
3e04a7b2-6eb6-4421-8f30-da0fd0ab60b8	5341e676-9aff-472f-893c-54299922d4de	qr_XodZ75qZ_eBBniY7c3AUAZ-eeEaBSLrf	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.909
c717a23c-7889-4ef3-affd-3945586de7be	850609be-7f71-4b7c-aedd-73de0f828cc4	qr_1tvHBuxJINeApV9_4dpUpjBKrwURKLNp	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.912
734e2aad-fdcb-47df-ab36-6d560b81b136	2ec69ba1-f748-4003-9080-d2b8d471b14a	qr_qyiMAl3tn1PYeb79uleCBFC089r7cXpS	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.914
0070cee0-043c-4ea8-a3b9-b32d192674d8	e6514727-9c9e-4e02-98a4-23311765c246	qr_Nh5mNESfhDl7odZ31zunczo1ginjVI20	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.918
34d0293d-42e3-45b5-a43a-f8d1b44091f9	a10eebb3-1e1a-4df7-a0e0-a6ddb39e6ea2	qr_57wfVoReJBrsEc7r361RoC3NEHJusChw	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.922
f388ca5e-411d-4372-992f-6870315ccd5c	1fc067e8-20fc-418f-b362-f137888d1842	qr_p6sD-bxoj7xnr9Ilf39PX9CovzB98JKF	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.926
62dd5c36-14b3-48a0-8827-dda7811b125c	89e3bf8a-cf9d-4410-92cd-3d2baddce277	qr_iXx2yXRTPXYgWuejsfroI41s9L7q1fEm	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.93
65e98530-77b6-4076-a543-328e83c161bc	54c5229c-fb70-46da-9415-88ce12e4539f	qr_UQWomea0LJtnD9g2U-cowNvju3MquDIY	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.933
ec4a62bf-4476-459b-9de4-210b40d7ce1b	dad33b2c-6938-4f8a-a907-3108bda720b6	qr_VeqCbpgfVzewfrlMBjuAGYYyT4wUeMOf	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.937
9a3a8239-97c0-49ca-a9e1-ccab228bc1c6	7f8fd615-958b-4ed8-b195-f0cb0fb1ece8	qr_Ebr_eIKbz7JEnrYV9KDyAIo4Ty1TSyPn	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.94
67739b14-b25b-4229-ab87-dda2b7608c99	caec61fb-9166-4c7c-bdd9-6164fd630103	qr_4ecl6LJKhEztkqJgHHP76MDQeZHBmV2d	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.944
32c1af1e-780f-45cf-8cd5-e76a7d472243	b8d54cd0-7d1f-4b08-a141-2605190b3ceb	qr_C5gGsnPUWAb9fbf60MaUvng8_9aKqUFx	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.948
d1764ba5-0aee-463a-8a2a-50ad4e97d8f1	2614e036-6348-4a42-8b9d-258139572ed6	qr_LfO-M6hvjVbMubxBjJxZ4nm6wnADUgfC	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.951
480207a8-ecdc-4326-b150-15457b5baa66	70db5730-7e6b-4854-a5bc-437f2433cfe5	qr_Q9OuJlcuDF23R3wtxIkfBsnnyyVzyCY5	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.955
600ae4fc-f513-402a-978c-5340b8b895b9	5f459b8d-9664-4dc2-b8ad-8426a286271b	qr_B4VqNtiGWs7A8re-rRe2Jhl53B4bMbOK	\N	881930b1-ac6d-40e9-aed4-23b38a1530c6	2026-11-11 13:47:04.959
\.


--
-- Data for Name: SystemSetting; Type: TABLE DATA; Schema: public; Owner: attendance_user
--

COPY public."SystemSetting" (key, value, "createdAt", "updatedAt") FROM stdin;
initial_setup_completed	2026-11-06T10:07:21.924Z	2026-11-06 10:07:22.607	2026-11-06 10:07:22.607
STUDENT_COURSES_b701252f-fa78-4543-b168-c3587646fa50	{"studentId":"b701252f-fa78-4543-b168-c3587646fa50","academicStatus":"REPEAT","courseIds":["2622aa44-a0fe-49d1-969b-4a485d62296a"],"notes":"","updatedAt":"2026-11-11T16:32:42.471Z"}	2026-11-11 16:32:42.473	2026-11-11 16:32:42.473
STUDENT_COURSES_7648f6c7-0f46-447b-b877-3f14ecb2cdea	{"studentId":"7648f6c7-0f46-447b-b877-3f14ecb2cdea","academicStatus":"REPEAT","courseIds":["11e80dca-9baa-4ca6-8383-b9c45df626ba","349a1970-6ada-4479-b97d-15fb1cacddbb","2622aa44-a0fe-49d1-969b-4a485d62296a","1441e34d-f326-40cf-9d75-0fd96ac3da2f"],"notes":"","updatedAt":"2026-11-11T16:33:44.085Z"}	2026-11-11 16:33:44.087	2026-11-11 16:33:44.087
STUDENT_COURSES_b35ec4e7-94a9-4bc0-9ff6-c7a00dbbf9ad	{"studentId":"b35ec4e7-94a9-4bc0-9ff6-c7a00dbbf9ad","academicStatus":"REPEAT","courseIds":["2622aa44-a0fe-49d1-969b-4a485d62296a"],"notes":"","updatedAt":"2026-11-11T16:35:19.235Z"}	2026-11-11 16:35:19.237	2026-11-11 16:35:19.237
STUDENT_COURSES_95e8dcef-dac3-4521-8f2c-015406f55a76	{"studentId":"95e8dcef-dac3-4521-8f2c-015406f55a76","academicStatus":"REPEAT","courseIds":["11e80dca-9baa-4ca6-8383-b9c45df626ba","349a1970-6ada-4479-b97d-15fb1cacddbb","2622aa44-a0fe-49d1-969b-4a485d62296a"],"notes":"","updatedAt":"2026-11-11T16:35:52.133Z"}	2026-11-11 16:35:52.135	2026-11-11 16:35:52.135
STUDENT_COURSES_542d85a0-42ac-407b-a3ec-0e1baf64afca	{"studentId":"542d85a0-42ac-407b-a3ec-0e1baf64afca","academicStatus":"REPEAT","courseIds":["2622aa44-a0fe-49d1-969b-4a485d62296a"],"notes":"","updatedAt":"2026-11-11T16:36:11.201Z"}	2026-11-11 16:36:11.203	2026-11-11 16:36:11.203
STUDENT_COURSES_6a8a563c-f6b4-4901-a9b2-11d811a119b9	{"studentId":"6a8a563c-f6b4-4901-a9b2-11d811a119b9","academicStatus":"REPEAT","courseIds":["181f8904-c74b-4552-bfa2-34320917743b","349a1970-6ada-4479-b97d-15fb1cacddbb","1441e34d-f326-40cf-9d75-0fd96ac3da2f"],"notes":"","updatedAt":"2026-11-11T16:36:37.642Z"}	2026-11-11 16:36:37.643	2026-11-11 16:36:37.643
STUDENT_COURSES_dd51884a-dfe8-40ad-a14d-1d1a02900912	{"studentId":"dd51884a-dfe8-40ad-a14d-1d1a02900912","academicStatus":"REPEAT","courseIds":["181f8904-c74b-4552-bfa2-34320917743b","11e80dca-9baa-4ca6-8383-b9c45df626ba","349a1970-6ada-4479-b97d-15fb1cacddbb","a0c103a8-cb31-4cb9-af84-10cd8cdf3c4b","2622aa44-a0fe-49d1-969b-4a485d62296a","1441e34d-f326-40cf-9d75-0fd96ac3da2f"],"notes":"","updatedAt":"2026-11-11T16:37:06.220Z"}	2026-11-11 16:37:06.221	2026-11-11 16:37:06.221
STUDENT_COURSES_5626a783-15bc-4f9e-9e92-e7aa26b29683	{"studentId":"5626a783-15bc-4f9e-9e92-e7aa26b29683","academicStatus":"REPEAT","courseIds":["181f8904-c74b-4552-bfa2-34320917743b","349a1970-6ada-4479-b97d-15fb1cacddbb","2622aa44-a0fe-49d1-969b-4a485d62296a","1441e34d-f326-40cf-9d75-0fd96ac3da2f"],"notes":"","updatedAt":"2026-11-11T16:37:46.171Z"}	2026-11-11 16:37:46.172	2026-11-11 16:37:46.172
STUDENT_COURSES_57526353-e3cb-43c3-a9be-d4fdfc1d4b1e	{"studentId":"57526353-e3cb-43c3-a9be-d4fdfc1d4b1e","academicStatus":"REPEAT","courseIds":["181f8904-c74b-4552-bfa2-34320917743b","11e80dca-9baa-4ca6-8383-b9c45df626ba","349a1970-6ada-4479-b97d-15fb1cacddbb","1441e34d-f326-40cf-9d75-0fd96ac3da2f"],"notes":"","updatedAt":"2026-11-11T16:38:31.075Z"}	2026-11-11 16:38:31.076	2026-11-11 16:38:31.076
STUDENT_COURSES_d4aaa83b-9ec1-4435-a52e-557c91fbfede	{"studentId":"d4aaa83b-9ec1-4435-a52e-557c91fbfede","academicStatus":"REPEAT","courseIds":["181f8904-c74b-4552-bfa2-34320917743b","11e80dca-9baa-4ca6-8383-b9c45df626ba","349a1970-6ada-4479-b97d-15fb1cacddbb","a0c103a8-cb31-4cb9-af84-10cd8cdf3c4b","3e1b1e09-3d59-4a0c-b9e7-5dd614cf9f25","2622aa44-a0fe-49d1-969b-4a485d62296a","1441e34d-f326-40cf-9d75-0fd96ac3da2f","e16de310-b49a-480e-8d63-b63f15dc3ef7"],"notes":"","updatedAt":"2026-11-11T16:38:50.287Z"}	2026-11-11 16:38:50.288	2026-11-11 16:38:50.288
STUDENT_COURSES_bec44d33-9aa2-4745-afe6-fb6488590874	{"studentId":"bec44d33-9aa2-4745-afe6-fb6488590874","academicStatus":"REPEAT","courseIds":["349a1970-6ada-4479-b97d-15fb1cacddbb","2622aa44-a0fe-49d1-969b-4a485d62296a","1441e34d-f326-40cf-9d75-0fd96ac3da2f"],"notes":"","updatedAt":"2026-11-11T16:39:43.338Z"}	2026-11-11 16:39:43.339	2026-11-11 16:39:43.339
STUDENT_COURSES_951fe6b5-c0ee-4f67-b56d-04e9dab757e1	{"studentId":"951fe6b5-c0ee-4f67-b56d-04e9dab757e1","academicStatus":"REPEAT","courseIds":["181f8904-c74b-4552-bfa2-34320917743b","349a1970-6ada-4479-b97d-15fb1cacddbb","2622aa44-a0fe-49d1-969b-4a485d62296a","1441e34d-f326-40cf-9d75-0fd96ac3da2f"],"notes":"","updatedAt":"2026-11-11T16:40:15.971Z"}	2026-11-11 16:40:15.972	2026-11-11 16:40:15.972
STUDENT_COURSES_fc86659a-bf9b-4b0b-96b1-bef3d385c0b1	{"studentId":"fc86659a-bf9b-4b0b-96b1-bef3d385c0b1","academicStatus":"REPEAT","courseIds":["349a1970-6ada-4479-b97d-15fb1cacddbb","2622aa44-a0fe-49d1-969b-4a485d62296a","1441e34d-f326-40cf-9d75-0fd96ac3da2f"],"notes":"","updatedAt":"2026-11-11T16:40:44.499Z"}	2026-11-11 16:40:44.499	2026-11-11 16:40:44.499
STUDENT_COURSES_2e33c729-e464-470e-8c1a-2a2d76c4adba	{"studentId":"2e33c729-e464-470e-8c1a-2a2d76c4adba","academicStatus":"REPEAT","courseIds":["2622aa44-a0fe-49d1-969b-4a485d62296a"],"notes":"","updatedAt":"2026-11-11T16:40:56.986Z"}	2026-11-11 16:40:56.987	2026-11-11 16:40:56.987
STUDENT_COURSES_49e286c3-d440-4590-ba9d-604b1ca579ff	{"studentId":"49e286c3-d440-4590-ba9d-604b1ca579ff","academicStatus":"REPEAT","courseIds":["349a1970-6ada-4479-b97d-15fb1cacddbb","2622aa44-a0fe-49d1-969b-4a485d62296a","1441e34d-f326-40cf-9d75-0fd96ac3da2f"],"notes":"","updatedAt":"2026-11-11T16:41:30.385Z"}	2026-11-11 16:41:21.9	2026-11-11 16:41:30.386
STUDENT_COURSES_dd5f1434-c289-4193-bf43-a205467559a7	{"studentId":"dd5f1434-c289-4193-bf43-a205467559a7","academicStatus":"REPEAT","courseIds":["11e80dca-9baa-4ca6-8383-b9c45df626ba","349a1970-6ada-4479-b97d-15fb1cacddbb","1441e34d-f326-40cf-9d75-0fd96ac3da2f"],"notes":"","updatedAt":"2026-11-11T16:41:53.537Z"}	2026-11-11 16:41:53.539	2026-11-11 16:41:53.539
\.


--
-- Data for Name: TeachingAssignment; Type: TABLE DATA; Schema: public; Owner: attendance_user
--

COPY public."TeachingAssignment" (id, "staffUserId", "courseId", "createdAt") FROM stdin;
1c20294f-af32-431d-9a02-a8da135d0e12	6ec9c995-64b3-413e-bab8-9533d21d126f	181f8904-c74b-4552-bfa2-34320917743b	2026-11-11 14:45:45.53
17e4cac4-c68a-4971-9ae4-e88cee6dc3cb	ecbfc25f-cc04-45b5-9f21-74665f4f10f4	181f8904-c74b-4552-bfa2-34320917743b	2026-11-11 14:46:11.81
e5a22ead-c75b-4450-a538-7a9cafb80e95	8a3efc47-e900-49ef-9caf-8e3fa27ac8b7	2622aa44-a0fe-49d1-969b-4a485d62296a	2026-11-11 14:46:48.919
9f6a171e-a873-4728-a1f6-5f7342d816e3	9b09a778-3728-46e1-8a8b-6f5a45f25030	2622aa44-a0fe-49d1-969b-4a485d62296a	2026-11-11 14:46:55.714
8395859e-4f81-48bd-9469-31a1c597a3ce	49def886-14ca-4d26-b1d6-ab71ebbb56fa	349a1970-6ada-4479-b97d-15fb1cacddbb	2026-11-11 14:47:07.836
35a4bf80-b503-4a10-9251-6ce6d40c04c1	1d22bbc5-b02a-4d11-8a95-c7c32f90cf10	349a1970-6ada-4479-b97d-15fb1cacddbb	2026-11-11 14:47:21.481
508f095c-a18e-4f6d-94b0-307f159d7e09	af8be5a0-7196-40ae-a79d-25fd9dcdca11	1441e34d-f326-40cf-9d75-0fd96ac3da2f	2026-11-11 14:47:48.426
5fbb3ee7-1e6b-4563-827c-2bfbb98d7224	3c9527a0-35b6-4456-99f0-c251e773faef	1441e34d-f326-40cf-9d75-0fd96ac3da2f	2026-11-11 14:47:55.338
daed5cb5-a50e-439e-98f6-3a9fe5e3a226	4cf6e382-e52d-48e2-816a-e1cbb0b4b772	11e80dca-9baa-4ca6-8383-b9c45df626ba	2026-11-11 14:48:11.916
78449566-adb4-428d-a3be-b3ddf18f3330	8521cfc0-8d24-4ab5-8674-7857195d34e1	11e80dca-9baa-4ca6-8383-b9c45df626ba	2026-11-11 14:48:33.537
699c9008-3788-44b4-96ab-d3bdbe5fcdcc	efdf9c07-e756-4945-9a45-af0b51db84dd	e16de310-b49a-480e-8d63-b63f15dc3ef7	2026-11-11 14:48:52.539
4fe733dc-e699-4576-be09-364152f3e77c	725ad425-541f-41e5-827b-1e4c4b243990	1441e34d-f326-40cf-9d75-0fd96ac3da2f	2026-11-11 14:49:11.89
1879edc8-4ba5-4428-b34c-1de4c1a16871	c78d3988-def2-4ee4-a72a-3410d89cdf79	1441e34d-f326-40cf-9d75-0fd96ac3da2f	2026-11-11 14:49:18.404
4490cede-7937-4156-b090-6164da31cd2b	fcb33c2d-e4fb-489e-ac71-a9f8f4d90ca1	a0c103a8-cb31-4cb9-af84-10cd8cdf3c4b	2026-11-11 14:49:45.954
63568a5b-4f3f-4572-ae4c-042626a4522d	fa7e9ebd-0f47-4d1d-9664-3becb064332a	3e1b1e09-3d59-4a0c-b9e7-5dd614cf9f25	2026-11-11 14:49:57.577
dc1942b8-3e75-49a4-adbd-8dd536255271	c941e1b1-0fab-4d3d-ba3a-9915a43c1ff8	1441e34d-f326-40cf-9d75-0fd96ac3da2f	2026-11-11 14:50:51.442
0f1f20a2-7d9e-4756-9566-f2f6e3c81ebc	613b34de-bac7-4603-b468-ccfe9cb4537b	11e80dca-9baa-4ca6-8383-b9c45df626ba	2026-11-11 14:51:22.661
d618fbb2-5375-4a14-a1eb-c627783f312a	74f44ea8-4e62-4c11-89b1-d772f05d1695	11e80dca-9baa-4ca6-8383-b9c45df626ba	2026-11-11 14:51:37.104
056d7689-a466-40e7-9233-a9548e1edaba	d6b92e20-1858-49bc-87ba-5eb59dffd987	349a1970-6ada-4479-b97d-15fb1cacddbb	2026-11-11 14:51:49.323
70e3fae1-7001-4ef1-8e8d-94370a8679a8	34e078ac-4ad3-4801-82f7-0816cb259c36	349a1970-6ada-4479-b97d-15fb1cacddbb	2026-11-11 14:51:57.035
a38118f6-928f-487a-bb0e-f16831635e2f	ab94b809-d363-491a-bdce-9c3a770ab397	a0c103a8-cb31-4cb9-af84-10cd8cdf3c4b	2026-11-11 14:52:03.666
ed05fb12-93e1-4b19-ac8b-18b6199da74b	ddadd424-42b7-4f53-ad8a-84345c3bdaec	a0c103a8-cb31-4cb9-af84-10cd8cdf3c4b	2026-11-11 14:52:10.027
fa890b14-1700-4c82-995e-050068816446	eab7a0ae-b2cd-4090-bbff-d19d1ea8dae2	2622aa44-a0fe-49d1-969b-4a485d62296a	2026-11-11 14:52:22.818
b5ae26c1-8831-4b71-a2d1-5922c98865d3	d98123a9-8054-496f-b3c7-6d280309ad14	2622aa44-a0fe-49d1-969b-4a485d62296a	2026-11-11 14:52:31.154
7bdbd5bc-dd1d-436c-96c2-a10e328ca50f	c941e1b1-0fab-4d3d-ba3a-9915a43c1ff8	181f8904-c74b-4552-bfa2-34320917743b	2026-11-11 14:52:43.595
669ae1f8-483a-469a-a43c-7ccd2c0b05cf	c532404e-cd7f-4b37-bb91-79f4a34644d9	181f8904-c74b-4552-bfa2-34320917743b	2026-11-11 14:52:54.306
\.


--
-- Data for Name: TimetableEntry; Type: TABLE DATA; Schema: public; Owner: attendance_user
--

COPY public."TimetableEntry" (id, "courseId", "sectionId", "dayOfWeek", "startTime", "endTime", "createdAt", "updatedAt", type, hall) FROM stdin;
8b280af8-4d0c-41f6-a5c0-6d608343dbea	e16de310-b49a-480e-8d63-b63f15dc3ef7	bd2707b8-2234-4cfb-8847-21b460a5046f	6	08:00	09:00	2026-11-11 17:10:14.237	2026-11-11 17:10:14.237	THEORETICAL	قاعة 15
17654d36-d3a1-42ee-9180-846775a10d78	e16de310-b49a-480e-8d63-b63f15dc3ef7	96fd4802-c311-4e15-8670-526d282ea6d6	6	08:00	09:00	2026-11-11 17:10:14.24	2026-11-11 17:10:14.24	THEORETICAL	قاعة 15
c9ababcb-4826-4f59-9d81-ebae2b3b6839	2622aa44-a0fe-49d1-969b-4a485d62296a	fbfdaf04-5337-4a45-b884-34ee187902b1	6	08:00	09:00	2026-11-11 17:10:14.241	2026-11-11 17:10:14.241	THEORETICAL	قاعة 19
fb7a7ae9-7e17-4ddf-bc3d-d994d9c2c302	2622aa44-a0fe-49d1-969b-4a485d62296a	43897e7f-b159-4093-beac-4a0cc42d5782	6	08:00	09:00	2026-11-11 17:10:14.242	2026-11-11 17:10:14.242	THEORETICAL	قاعة 19
75aa143c-315c-44dd-8de4-4cd00392f5df	181f8904-c74b-4552-bfa2-34320917743b	a47c3505-eca8-478b-9df3-91e5504811fa	6	08:00	09:00	2026-11-11 17:10:14.243	2026-11-11 17:10:14.243	THEORETICAL	قاعة 15
7f214432-a9f5-4c5a-9609-d50928a6be1e	181f8904-c74b-4552-bfa2-34320917743b	b35abf9d-5911-405d-85f1-e2700c50cf1d	6	08:00	09:00	2026-11-11 17:10:14.244	2026-11-11 17:10:14.244	THEORETICAL	قاعة 15
b97f3fd3-71e9-4470-8a55-94f95c152aee	2622aa44-a0fe-49d1-969b-4a485d62296a	bd2707b8-2234-4cfb-8847-21b460a5046f	6	09:00	10:00	2026-11-11 17:10:14.245	2026-11-11 17:10:14.245	THEORETICAL	قاعة 15
136e47a3-b063-4bcc-ac76-f1d5ed7f1749	2622aa44-a0fe-49d1-969b-4a485d62296a	96fd4802-c311-4e15-8670-526d282ea6d6	6	09:00	10:00	2026-11-11 17:10:14.245	2026-11-11 17:10:14.245	THEORETICAL	قاعة 15
b21dd44e-f345-44dc-9d47-e977c8de02a2	e16de310-b49a-480e-8d63-b63f15dc3ef7	567ccb95-62b5-446f-848b-8b991ce5b18c	6	09:00	10:00	2026-11-11 17:10:14.246	2026-11-11 17:10:14.246	THEORETICAL	قاعة 19
adfcc7ed-c656-4524-a24f-789d5c0bdd0c	e16de310-b49a-480e-8d63-b63f15dc3ef7	01e1b86f-19ff-4e51-a236-e30b97f47689	6	09:00	10:00	2026-11-11 17:10:14.247	2026-11-11 17:10:14.247	THEORETICAL	قاعة 19
3fed2362-4b5b-421b-9359-45d4b3611399	2622aa44-a0fe-49d1-969b-4a485d62296a	a47c3505-eca8-478b-9df3-91e5504811fa	6	09:00	10:00	2026-11-11 17:10:14.247	2026-11-11 17:10:14.247	THEORETICAL	قاعة 15
d1c2ac7f-f14d-418a-b288-989bf4a58ce1	2622aa44-a0fe-49d1-969b-4a485d62296a	b35abf9d-5911-405d-85f1-e2700c50cf1d	6	09:00	10:00	2026-11-11 17:10:14.248	2026-11-11 17:10:14.248	THEORETICAL	قاعة 15
5ed8bdee-7d64-4ea8-b0c7-c5e7eeaa590c	a0c103a8-cb31-4cb9-af84-10cd8cdf3c4b	bd2707b8-2234-4cfb-8847-21b460a5046f	6	10:00	11:00	2026-11-11 17:10:14.249	2026-11-11 17:10:14.249	THEORETICAL	قاعة 15
a98729c2-4ec5-4427-a3d8-a4cd0487e28d	a0c103a8-cb31-4cb9-af84-10cd8cdf3c4b	96fd4802-c311-4e15-8670-526d282ea6d6	6	10:00	11:00	2026-11-11 17:10:14.25	2026-11-11 17:10:14.25	THEORETICAL	قاعة 15
621a1a2d-48d4-404c-baf0-31d7711f46a9	2622aa44-a0fe-49d1-969b-4a485d62296a	567ccb95-62b5-446f-848b-8b991ce5b18c	6	10:00	11:00	2026-11-11 17:10:14.25	2026-11-11 17:10:14.25	THEORETICAL	قاعة 19
78653735-73bb-4f62-a153-7a12b8ca62c4	2622aa44-a0fe-49d1-969b-4a485d62296a	01e1b86f-19ff-4e51-a236-e30b97f47689	6	10:00	11:00	2026-11-11 17:10:14.251	2026-11-11 17:10:14.251	THEORETICAL	قاعة 19
71351130-e923-4c1e-b9fe-724f867e5075	e16de310-b49a-480e-8d63-b63f15dc3ef7	fbfdaf04-5337-4a45-b884-34ee187902b1	6	10:00	11:00	2026-11-11 17:10:14.252	2026-11-11 17:10:14.252	THEORETICAL	قاعة 15
1ffc28b5-f2d9-4c4d-9ab1-9cda1cb2b7a3	e16de310-b49a-480e-8d63-b63f15dc3ef7	43897e7f-b159-4093-beac-4a0cc42d5782	6	10:00	11:00	2026-11-11 17:10:14.252	2026-11-11 17:10:14.252	THEORETICAL	قاعة 15
d898a7b4-1a8c-461b-94ed-6f453d650511	181f8904-c74b-4552-bfa2-34320917743b	567ccb95-62b5-446f-848b-8b991ce5b18c	6	11:00	12:00	2026-11-11 17:10:14.253	2026-11-11 17:10:14.253	THEORETICAL	قاعة 15
2fda4ef9-ff85-4ce0-8c27-7822298c8e34	181f8904-c74b-4552-bfa2-34320917743b	01e1b86f-19ff-4e51-a236-e30b97f47689	6	11:00	12:00	2026-11-11 17:10:14.254	2026-11-11 17:10:14.254	THEORETICAL	قاعة 15
52fa3db5-01b4-45b3-9b8a-6d7f54311efd	a0c103a8-cb31-4cb9-af84-10cd8cdf3c4b	fbfdaf04-5337-4a45-b884-34ee187902b1	6	11:00	12:00	2026-11-11 17:10:14.254	2026-11-11 17:10:14.254	THEORETICAL	قاعة 19
21f58765-d279-4825-b79f-c7115fb8473d	a0c103a8-cb31-4cb9-af84-10cd8cdf3c4b	43897e7f-b159-4093-beac-4a0cc42d5782	6	11:00	12:00	2026-11-11 17:10:14.255	2026-11-11 17:10:14.255	THEORETICAL	قاعة 19
2fae61e9-af07-407f-8892-6a4eb2a224da	e16de310-b49a-480e-8d63-b63f15dc3ef7	a47c3505-eca8-478b-9df3-91e5504811fa	6	11:00	12:00	2026-11-11 17:10:14.256	2026-11-11 17:10:14.256	THEORETICAL	قاعة 15
a2e11302-5459-4644-8e95-a64329640619	e16de310-b49a-480e-8d63-b63f15dc3ef7	b35abf9d-5911-405d-85f1-e2700c50cf1d	6	11:00	12:00	2026-11-11 17:10:14.256	2026-11-11 17:10:14.256	THEORETICAL	قاعة 15
e2f70b52-8d43-490b-8101-78ee17ab209d	181f8904-c74b-4552-bfa2-34320917743b	bd2707b8-2234-4cfb-8847-21b460a5046f	6	12:00	13:00	2026-11-11 17:10:14.257	2026-11-11 17:10:14.257	THEORETICAL	قاعة 15
c0c6a871-874e-4dad-a103-6f51d667a81d	181f8904-c74b-4552-bfa2-34320917743b	96fd4802-c311-4e15-8670-526d282ea6d6	6	12:00	13:00	2026-11-11 17:10:14.258	2026-11-11 17:10:14.258	THEORETICAL	قاعة 15
c9fd3c87-d4f3-4de1-90e8-3d8c40ca0ae5	a0c103a8-cb31-4cb9-af84-10cd8cdf3c4b	567ccb95-62b5-446f-848b-8b991ce5b18c	6	12:00	13:00	2026-11-11 17:10:14.258	2026-11-11 17:10:14.258	THEORETICAL	قاعة 19
bd38222b-565c-4915-a8c3-ed53dc1f5a17	a0c103a8-cb31-4cb9-af84-10cd8cdf3c4b	01e1b86f-19ff-4e51-a236-e30b97f47689	6	12:00	13:00	2026-11-11 17:10:14.259	2026-11-11 17:10:14.259	THEORETICAL	قاعة 19
f088dd11-a173-4a58-9fe2-88a2c12e004d	a0c103a8-cb31-4cb9-af84-10cd8cdf3c4b	a47c3505-eca8-478b-9df3-91e5504811fa	6	12:00	13:00	2026-11-11 17:10:14.26	2026-11-11 17:10:14.26	THEORETICAL	قاعة 15
d579e6c2-bb57-446b-b9ed-0239468f7de6	a0c103a8-cb31-4cb9-af84-10cd8cdf3c4b	b35abf9d-5911-405d-85f1-e2700c50cf1d	6	12:00	13:00	2026-11-11 17:10:14.26	2026-11-11 17:10:14.26	THEORETICAL	قاعة 15
a22efa75-d6c1-40b1-92d4-cb22c6aba202	a0c103a8-cb31-4cb9-af84-10cd8cdf3c4b	bd2707b8-2234-4cfb-8847-21b460a5046f	0	08:00	10:00	2026-11-11 17:10:14.261	2026-11-11 17:10:14.261	PRACTICAL	مختبر الاحياء
8a98806c-b2f9-4606-92a9-46b36e4e37f2	181f8904-c74b-4552-bfa2-34320917743b	96fd4802-c311-4e15-8670-526d282ea6d6	0	08:00	10:00	2026-11-11 17:10:14.262	2026-11-11 17:10:14.262	PRACTICAL	مختبر امراض الدم
f913ff43-7635-4761-a36e-84c001ed3d5e	11e80dca-9baa-4ca6-8383-b9c45df626ba	567ccb95-62b5-446f-848b-8b991ce5b18c	0	08:00	10:00	2026-11-11 17:10:14.262	2026-11-11 17:10:14.262	PRACTICAL	مختبر الشرائح
f3820d82-a822-4f34-aba2-c752a9e62e96	349a1970-6ada-4479-b97d-15fb1cacddbb	01e1b86f-19ff-4e51-a236-e30b97f47689	0	08:00	10:00	2026-11-11 17:10:14.263	2026-11-11 17:10:14.263	PRACTICAL	مختبر الطفيليات
c3f542ab-f374-4557-b7e6-ec3ecaf51c92	2622aa44-a0fe-49d1-969b-4a485d62296a	fbfdaf04-5337-4a45-b884-34ee187902b1	0	08:00	10:00	2026-11-11 17:10:14.263	2026-11-11 17:10:14.263	PRACTICAL	مختبر الكيمياء
c480f71c-d8a7-45b7-982c-870ee15907e6	2622aa44-a0fe-49d1-969b-4a485d62296a	bd2707b8-2234-4cfb-8847-21b460a5046f	0	10:00	12:00	2026-11-11 17:10:14.264	2026-11-11 17:10:14.264	PRACTICAL	مختبر الكيمياء
69c283b3-edd2-4574-8ddc-716942994c81	a0c103a8-cb31-4cb9-af84-10cd8cdf3c4b	96fd4802-c311-4e15-8670-526d282ea6d6	0	10:00	12:00	2026-11-11 17:10:14.264	2026-11-11 17:10:14.264	PRACTICAL	مختبر الاحياء
c3eb327c-2699-4222-a9c2-29a0c39aa3db	181f8904-c74b-4552-bfa2-34320917743b	567ccb95-62b5-446f-848b-8b991ce5b18c	0	10:00	12:00	2026-11-11 17:10:14.265	2026-11-11 17:10:14.265	PRACTICAL	مختبر امراض الدم
b13b029f-3ad7-4be1-8cdb-9a1ef4346b2c	11e80dca-9baa-4ca6-8383-b9c45df626ba	01e1b86f-19ff-4e51-a236-e30b97f47689	0	10:00	12:00	2026-11-11 17:10:14.265	2026-11-11 17:10:14.265	PRACTICAL	مختبر الشرائح
4131327f-3f3d-4587-be11-30f1ada824bb	349a1970-6ada-4479-b97d-15fb1cacddbb	43897e7f-b159-4093-beac-4a0cc42d5782	0	10:00	12:00	2026-11-11 17:10:14.266	2026-11-11 17:10:14.266	PRACTICAL	مختبر الطفيليات
fc4faef0-3b38-4fe1-8208-f0ad6c4123c4	2622aa44-a0fe-49d1-969b-4a485d62296a	96fd4802-c311-4e15-8670-526d282ea6d6	0	12:00	14:00	2026-11-11 17:10:14.266	2026-11-11 17:10:14.266	PRACTICAL	مختبر الكيمياء
faeb27aa-601d-4219-bae1-5e29ca3738d0	a0c103a8-cb31-4cb9-af84-10cd8cdf3c4b	567ccb95-62b5-446f-848b-8b991ce5b18c	0	12:00	14:00	2026-11-11 17:10:14.267	2026-11-11 17:10:14.267	PRACTICAL	مختبر الاحياء
562c149b-0226-43ac-965e-518040b3eb34	181f8904-c74b-4552-bfa2-34320917743b	01e1b86f-19ff-4e51-a236-e30b97f47689	0	12:00	14:00	2026-11-11 17:10:14.268	2026-11-11 17:10:14.268	PRACTICAL	مختبر امراض الدم
000a96b1-810b-4280-829d-9460f91d3d02	11e80dca-9baa-4ca6-8383-b9c45df626ba	fbfdaf04-5337-4a45-b884-34ee187902b1	0	12:00	14:00	2026-11-11 17:10:14.269	2026-11-11 17:10:14.269	PRACTICAL	مختبر الشرائح
84f342eb-601b-41ec-ab93-62caaa7a772e	2622aa44-a0fe-49d1-969b-4a485d62296a	43897e7f-b159-4093-beac-4a0cc42d5782	0	12:00	14:00	2026-11-11 17:10:14.269	2026-11-11 17:10:14.269	PRACTICAL	مختبر الكيمياء
31118c0a-d961-457c-a080-bb92b267eb65	2622aa44-a0fe-49d1-969b-4a485d62296a	567ccb95-62b5-446f-848b-8b991ce5b18c	1	08:00	10:00	2026-11-11 17:10:14.27	2026-11-11 17:10:14.27	PRACTICAL	مختبر الكيمياء
986038ed-3f7c-4b98-bdc7-11ae3eb127b3	a0c103a8-cb31-4cb9-af84-10cd8cdf3c4b	01e1b86f-19ff-4e51-a236-e30b97f47689	1	08:00	10:00	2026-11-11 17:10:14.27	2026-11-11 17:10:14.27	PRACTICAL	مختبر الاحياء
67f1ddef-a881-409a-8af9-802ca70dc53b	181f8904-c74b-4552-bfa2-34320917743b	fbfdaf04-5337-4a45-b884-34ee187902b1	1	08:00	10:00	2026-11-11 17:10:14.271	2026-11-11 17:10:14.271	PRACTICAL	مختبر امراض الدم
23777330-3466-4e90-8c2e-975dae76f2ab	11e80dca-9baa-4ca6-8383-b9c45df626ba	43897e7f-b159-4093-beac-4a0cc42d5782	1	08:00	10:00	2026-11-11 17:10:14.271	2026-11-11 17:10:14.271	PRACTICAL	مختبر الشرائح
3b463cec-a48d-4057-b363-b17d4b623930	349a1970-6ada-4479-b97d-15fb1cacddbb	a47c3505-eca8-478b-9df3-91e5504811fa	1	08:00	10:00	2026-11-11 17:10:14.272	2026-11-11 17:10:14.272	PRACTICAL	مختبر الطفيليات
7c69b456-9d42-4f4f-ab74-04d9592eacc7	2622aa44-a0fe-49d1-969b-4a485d62296a	01e1b86f-19ff-4e51-a236-e30b97f47689	1	10:00	12:00	2026-11-11 17:10:14.272	2026-11-11 17:10:14.272	PRACTICAL	مختبر الكيمياء
85bcb662-b517-4c07-9fe5-29f8290973c3	349a1970-6ada-4479-b97d-15fb1cacddbb	fbfdaf04-5337-4a45-b884-34ee187902b1	1	10:00	12:00	2026-11-11 17:10:14.273	2026-11-11 17:10:14.273	PRACTICAL	مختبر الطفيليات
5a8fcb55-c44f-4fc7-a0c8-d9201d5dc464	1441e34d-f326-40cf-9d75-0fd96ac3da2f	43897e7f-b159-4093-beac-4a0cc42d5782	1	10:00	12:00	2026-11-11 17:10:14.273	2026-11-11 17:10:14.273	PRACTICAL	مختبر الاحياء
c657ee3f-4f43-4dcc-b948-68ae13a4ac75	181f8904-c74b-4552-bfa2-34320917743b	a47c3505-eca8-478b-9df3-91e5504811fa	1	10:00	12:00	2026-11-11 17:10:14.274	2026-11-11 17:10:14.274	PRACTICAL	مختبر امراض الدم
c645d5d8-c626-45bd-848a-9601087f8bfb	11e80dca-9baa-4ca6-8383-b9c45df626ba	b35abf9d-5911-405d-85f1-e2700c50cf1d	1	10:00	12:00	2026-11-11 17:10:14.274	2026-11-11 17:10:14.274	PRACTICAL	مختبر الشرائح
6e27ca54-18e8-4dc5-bb75-eb4c230c38e9	1441e34d-f326-40cf-9d75-0fd96ac3da2f	fbfdaf04-5337-4a45-b884-34ee187902b1	1	12:00	14:00	2026-11-11 17:10:14.275	2026-11-11 17:10:14.275	PRACTICAL	مختبر الاحياء
92cf25b7-51c9-471c-911e-c44da1c9c88f	181f8904-c74b-4552-bfa2-34320917743b	43897e7f-b159-4093-beac-4a0cc42d5782	1	12:00	14:00	2026-11-11 17:10:14.276	2026-11-11 17:10:14.276	PRACTICAL	مختبر امراض الدم
7b8839ba-a5fc-428e-8e16-c0a5e837c4d3	11e80dca-9baa-4ca6-8383-b9c45df626ba	a47c3505-eca8-478b-9df3-91e5504811fa	1	12:00	14:00	2026-11-11 17:10:14.276	2026-11-11 17:10:14.276	PRACTICAL	مختبر الشرائح
4b960de3-dacc-4667-bf10-d2efa0ace3a7	2622aa44-a0fe-49d1-969b-4a485d62296a	b35abf9d-5911-405d-85f1-e2700c50cf1d	1	12:00	14:00	2026-11-11 17:10:14.277	2026-11-11 17:10:14.277	PRACTICAL	مختبر الكيمياء
d6098f2a-66f0-49b6-8451-a8a759b0f3cc	349a1970-6ada-4479-b97d-15fb1cacddbb	bd2707b8-2234-4cfb-8847-21b460a5046f	2	08:00	10:00	2026-11-11 17:10:14.277	2026-11-11 17:10:14.277	PRACTICAL	مختبر الطفيليات
a05b04de-ca5f-45fa-a7b9-5d7334e41c40	1441e34d-f326-40cf-9d75-0fd96ac3da2f	96fd4802-c311-4e15-8670-526d282ea6d6	2	08:00	10:00	2026-11-11 17:10:14.278	2026-11-11 17:10:14.278	PRACTICAL	مختبر الاحياء
10259430-81f6-49a1-9438-bfef4ee85b16	2622aa44-a0fe-49d1-969b-4a485d62296a	a47c3505-eca8-478b-9df3-91e5504811fa	2	08:00	10:00	2026-11-11 17:10:14.278	2026-11-11 17:10:14.278	PRACTICAL	مختبر الكيمياء
9794d5b7-b0cb-4b7b-9bcb-c9762b985be3	181f8904-c74b-4552-bfa2-34320917743b	b35abf9d-5911-405d-85f1-e2700c50cf1d	2	08:00	10:00	2026-11-11 17:10:14.279	2026-11-11 17:10:14.279	PRACTICAL	مختبر امراض الدم
71455605-0c89-4d34-a0bb-88d69cf5deec	11e80dca-9baa-4ca6-8383-b9c45df626ba	bd2707b8-2234-4cfb-8847-21b460a5046f	2	10:00	12:00	2026-11-11 17:10:14.28	2026-11-11 17:10:14.28	PRACTICAL	مختبر الشرائح
b8432081-bfa1-4e7c-8d58-5147f4cc504c	349a1970-6ada-4479-b97d-15fb1cacddbb	96fd4802-c311-4e15-8670-526d282ea6d6	2	10:00	12:00	2026-11-11 17:10:14.28	2026-11-11 17:10:14.28	PRACTICAL	مختبر الطفيليات
5bf25b20-c0bf-4fc7-9d85-fd13d08b6d8b	1441e34d-f326-40cf-9d75-0fd96ac3da2f	567ccb95-62b5-446f-848b-8b991ce5b18c	2	10:00	12:00	2026-11-11 17:10:14.281	2026-11-11 17:10:14.281	PRACTICAL	مختبر الاحياء
407713c2-2783-4442-8f23-bc720550a9f6	a0c103a8-cb31-4cb9-af84-10cd8cdf3c4b	a47c3505-eca8-478b-9df3-91e5504811fa	2	10:00	12:00	2026-11-11 17:10:14.281	2026-11-11 17:10:14.281	PRACTICAL	مختبر الاحياء
fc4c2af9-30da-48b0-8c50-c500d1c5d396	349a1970-6ada-4479-b97d-15fb1cacddbb	b35abf9d-5911-405d-85f1-e2700c50cf1d	2	10:00	12:00	2026-11-11 17:10:14.282	2026-11-11 17:10:14.282	PRACTICAL	مختبر الطفيليات
23ba7716-85f1-47b9-a546-1ae92a4ac0af	181f8904-c74b-4552-bfa2-34320917743b	bd2707b8-2234-4cfb-8847-21b460a5046f	2	12:00	14:00	2026-11-11 17:10:14.283	2026-11-11 17:10:14.283	PRACTICAL	مختبر امراض الدم
8e4806ef-483b-4ce3-9509-7d691e990473	11e80dca-9baa-4ca6-8383-b9c45df626ba	96fd4802-c311-4e15-8670-526d282ea6d6	2	12:00	14:00	2026-11-11 17:10:14.283	2026-11-11 17:10:14.283	PRACTICAL	مختبر الشرائح
532ee6e1-cff1-4d16-8c55-f97d217f41dd	1441e34d-f326-40cf-9d75-0fd96ac3da2f	01e1b86f-19ff-4e51-a236-e30b97f47689	2	12:00	14:00	2026-11-11 17:10:14.284	2026-11-11 17:10:14.284	PRACTICAL	مختبر الاحياء
06447e8a-845c-4947-990a-d7aea3b6cf02	a0c103a8-cb31-4cb9-af84-10cd8cdf3c4b	b35abf9d-5911-405d-85f1-e2700c50cf1d	2	12:00	14:00	2026-11-11 17:10:14.284	2026-11-11 17:10:14.284	PRACTICAL	مختبر الاحياء
94b115f1-62cb-4b7a-b65d-75b238080881	181f8904-c74b-4552-bfa2-34320917743b	fbfdaf04-5337-4a45-b884-34ee187902b1	2	12:00	13:00	2026-11-11 17:10:14.285	2026-11-11 17:10:14.285	THEORETICAL	قاعة 16
7beb74ef-af7a-48b2-b4b2-b51543e82818	181f8904-c74b-4552-bfa2-34320917743b	43897e7f-b159-4093-beac-4a0cc42d5782	2	12:00	13:00	2026-11-11 17:10:14.285	2026-11-11 17:10:14.285	THEORETICAL	قاعة 16
e0c4a7d0-3015-4518-8fe9-68d78084e72a	3e1b1e09-3d59-4a0c-b9e7-5dd614cf9f25	bd2707b8-2234-4cfb-8847-21b460a5046f	2	13:00	14:00	2026-11-11 17:10:14.286	2026-11-11 17:10:14.286	THEORETICAL	قاعة 16
6e1f14ab-3f87-4826-8447-e0b31f434f12	3e1b1e09-3d59-4a0c-b9e7-5dd614cf9f25	96fd4802-c311-4e15-8670-526d282ea6d6	2	13:00	14:00	2026-11-11 17:10:14.286	2026-11-11 17:10:14.286	THEORETICAL	قاعة 16
2a600e2c-e420-4723-a1ca-cf01861a46e0	3e1b1e09-3d59-4a0c-b9e7-5dd614cf9f25	fbfdaf04-5337-4a45-b884-34ee187902b1	2	13:00	14:00	2026-11-11 17:10:14.287	2026-11-11 17:10:14.287	THEORETICAL	قاعة 18
887c5677-a096-4440-8dca-54b68d279dee	3e1b1e09-3d59-4a0c-b9e7-5dd614cf9f25	43897e7f-b159-4093-beac-4a0cc42d5782	2	13:00	14:00	2026-11-11 17:10:14.288	2026-11-11 17:10:14.288	THEORETICAL	قاعة 18
fe76ec97-e994-4b3d-b892-5ea53f58178f	3e1b1e09-3d59-4a0c-b9e7-5dd614cf9f25	567ccb95-62b5-446f-848b-8b991ce5b18c	2	14:00	15:00	2026-11-11 17:10:14.289	2026-11-11 17:10:14.289	THEORETICAL	قاعة 16
7bbc76f6-1766-4b0b-bf12-aad1fa290fde	3e1b1e09-3d59-4a0c-b9e7-5dd614cf9f25	01e1b86f-19ff-4e51-a236-e30b97f47689	2	14:00	15:00	2026-11-11 17:10:14.289	2026-11-11 17:10:14.289	THEORETICAL	قاعة 16
18a8484f-8bfe-4a40-9f03-2b776c56f25c	3e1b1e09-3d59-4a0c-b9e7-5dd614cf9f25	a47c3505-eca8-478b-9df3-91e5504811fa	2	14:00	15:00	2026-11-11 17:10:14.29	2026-11-11 17:10:14.29	THEORETICAL	قاعة 18
0a7a34d4-10f4-48ab-9b2a-2e10f4a7c6ed	3e1b1e09-3d59-4a0c-b9e7-5dd614cf9f25	b35abf9d-5911-405d-85f1-e2700c50cf1d	2	14:00	15:00	2026-11-11 17:10:14.291	2026-11-11 17:10:14.291	THEORETICAL	قاعة 18
3769ca8b-24af-4f7f-82fd-d096fa98f97c	11e80dca-9baa-4ca6-8383-b9c45df626ba	bd2707b8-2234-4cfb-8847-21b460a5046f	3	08:00	09:00	2026-11-11 17:10:14.291	2026-11-11 17:10:14.291	THEORETICAL	قاعة 15
a39eaf83-f00b-4e60-951a-ffca9850057b	11e80dca-9baa-4ca6-8383-b9c45df626ba	96fd4802-c311-4e15-8670-526d282ea6d6	3	08:00	09:00	2026-11-11 17:10:14.292	2026-11-11 17:10:14.292	THEORETICAL	قاعة 15
e6911f2c-b1ad-4979-968a-ddff9ba2689a	349a1970-6ada-4479-b97d-15fb1cacddbb	567ccb95-62b5-446f-848b-8b991ce5b18c	3	08:00	09:00	2026-11-11 17:10:14.293	2026-11-11 17:10:14.293	THEORETICAL	قاعة 19
b8f3e131-7f27-4176-954d-c0dbc665707a	349a1970-6ada-4479-b97d-15fb1cacddbb	01e1b86f-19ff-4e51-a236-e30b97f47689	3	08:00	09:00	2026-11-11 17:10:14.294	2026-11-11 17:10:14.294	THEORETICAL	قاعة 19
76b5d958-371c-4286-a3d8-d0431ce0c229	1441e34d-f326-40cf-9d75-0fd96ac3da2f	fbfdaf04-5337-4a45-b884-34ee187902b1	3	08:00	09:00	2026-11-11 17:10:14.295	2026-11-11 17:10:14.295	THEORETICAL	قاعة 15
ff488531-474c-4e8d-8051-dfde7b42a7fd	1441e34d-f326-40cf-9d75-0fd96ac3da2f	43897e7f-b159-4093-beac-4a0cc42d5782	3	08:00	09:00	2026-11-11 17:10:14.296	2026-11-11 17:10:14.296	THEORETICAL	قاعة 15
a13507dc-c530-47c8-96bb-718c6f840407	349a1970-6ada-4479-b97d-15fb1cacddbb	bd2707b8-2234-4cfb-8847-21b460a5046f	3	09:00	10:00	2026-11-11 17:10:14.296	2026-11-11 17:10:14.296	THEORETICAL	قاعة 15
b87e26a2-5fdc-419c-b6bf-2ea092ed9da0	349a1970-6ada-4479-b97d-15fb1cacddbb	96fd4802-c311-4e15-8670-526d282ea6d6	3	09:00	10:00	2026-11-11 17:10:14.297	2026-11-11 17:10:14.297	THEORETICAL	قاعة 15
ce0c936a-1f98-47aa-87a9-ae965b1119a5	1441e34d-f326-40cf-9d75-0fd96ac3da2f	567ccb95-62b5-446f-848b-8b991ce5b18c	3	09:00	10:00	2026-11-11 17:10:14.298	2026-11-11 17:10:14.298	THEORETICAL	قاعة 19
936d232a-719c-4f07-b5bb-47bdb8f3f3df	1441e34d-f326-40cf-9d75-0fd96ac3da2f	01e1b86f-19ff-4e51-a236-e30b97f47689	3	09:00	10:00	2026-11-11 17:10:14.298	2026-11-11 17:10:14.298	THEORETICAL	قاعة 19
db9abb17-7daf-4e38-946b-fdedc32f44e5	11e80dca-9baa-4ca6-8383-b9c45df626ba	a47c3505-eca8-478b-9df3-91e5504811fa	3	09:00	10:00	2026-11-11 17:10:14.299	2026-11-11 17:10:14.299	THEORETICAL	قاعة 15
7e9f3577-5eb9-4d3e-b33b-84561bddf4dc	11e80dca-9baa-4ca6-8383-b9c45df626ba	b35abf9d-5911-405d-85f1-e2700c50cf1d	3	09:00	10:00	2026-11-11 17:10:14.299	2026-11-11 17:10:14.299	THEORETICAL	قاعة 15
85d5cfb3-1a6e-43c7-ad4d-a5a3b8a09bd9	1441e34d-f326-40cf-9d75-0fd96ac3da2f	bd2707b8-2234-4cfb-8847-21b460a5046f	3	10:00	11:00	2026-11-11 17:10:14.3	2026-11-11 17:10:14.3	THEORETICAL	قاعة 15
a2d11a99-c2f1-4ff8-aac5-a9c9439c6306	1441e34d-f326-40cf-9d75-0fd96ac3da2f	96fd4802-c311-4e15-8670-526d282ea6d6	3	10:00	11:00	2026-11-11 17:10:14.3	2026-11-11 17:10:14.3	THEORETICAL	قاعة 15
f6259d77-3b5b-47ba-bbd8-4fdd4ad41b06	349a1970-6ada-4479-b97d-15fb1cacddbb	fbfdaf04-5337-4a45-b884-34ee187902b1	3	10:00	11:00	2026-11-11 17:10:14.301	2026-11-11 17:10:14.301	THEORETICAL	قاعة 19
3c731e8a-f513-4b20-a786-c6726e1612dd	349a1970-6ada-4479-b97d-15fb1cacddbb	43897e7f-b159-4093-beac-4a0cc42d5782	3	10:00	11:00	2026-11-11 17:10:14.301	2026-11-11 17:10:14.301	THEORETICAL	قاعة 19
09992ebc-6b1c-49c5-a2af-e9a60c8edfcf	1441e34d-f326-40cf-9d75-0fd96ac3da2f	a47c3505-eca8-478b-9df3-91e5504811fa	3	10:00	11:00	2026-11-11 17:10:14.302	2026-11-11 17:10:14.302	THEORETICAL	قاعة 15
e39a420d-4663-4bfb-acdf-17a403b1fed2	1441e34d-f326-40cf-9d75-0fd96ac3da2f	b35abf9d-5911-405d-85f1-e2700c50cf1d	3	10:00	11:00	2026-11-11 17:10:14.302	2026-11-11 17:10:14.302	THEORETICAL	قاعة 15
faf07557-4e3d-4574-a4e6-50e46c97ae86	11e80dca-9baa-4ca6-8383-b9c45df626ba	567ccb95-62b5-446f-848b-8b991ce5b18c	3	11:00	12:00	2026-11-11 17:10:14.303	2026-11-11 17:10:14.303	THEORETICAL	قاعة 15
937f431f-57c4-47df-a2bf-92f079251006	11e80dca-9baa-4ca6-8383-b9c45df626ba	01e1b86f-19ff-4e51-a236-e30b97f47689	3	11:00	12:00	2026-11-11 17:10:14.303	2026-11-11 17:10:14.303	THEORETICAL	قاعة 15
874eaf93-eccf-482f-bfe1-f6d1581aba81	11e80dca-9baa-4ca6-8383-b9c45df626ba	fbfdaf04-5337-4a45-b884-34ee187902b1	3	11:00	12:00	2026-11-11 17:10:14.304	2026-11-11 17:10:14.304	THEORETICAL	قاعة 19
9c6b98d3-3ba8-4d52-9c4f-559d82ecee76	11e80dca-9baa-4ca6-8383-b9c45df626ba	43897e7f-b159-4093-beac-4a0cc42d5782	3	11:00	12:00	2026-11-11 17:10:14.305	2026-11-11 17:10:14.305	THEORETICAL	قاعة 19
f0df537c-e0e5-4dc5-8b34-de27cd9dba1f	349a1970-6ada-4479-b97d-15fb1cacddbb	a47c3505-eca8-478b-9df3-91e5504811fa	3	11:00	12:00	2026-11-11 17:10:14.305	2026-11-11 17:10:14.305	THEORETICAL	قاعة 15
65843561-ae4e-45a7-bfec-c71cb5a4906b	349a1970-6ada-4479-b97d-15fb1cacddbb	b35abf9d-5911-405d-85f1-e2700c50cf1d	3	11:00	12:00	2026-11-11 17:10:14.306	2026-11-11 17:10:14.306	THEORETICAL	قاعة 15
cd0b3997-b2e6-4a14-8dc4-9aafb2dc3a2d	1441e34d-f326-40cf-9d75-0fd96ac3da2f	bd2707b8-2234-4cfb-8847-21b460a5046f	3	12:00	14:00	2026-11-11 17:10:14.306	2026-11-11 17:10:14.306	PRACTICAL	مختبر الاحياء
461e46d2-09f3-4314-813b-199d6f748600	349a1970-6ada-4479-b97d-15fb1cacddbb	567ccb95-62b5-446f-848b-8b991ce5b18c	3	12:00	14:00	2026-11-11 17:10:14.307	2026-11-11 17:10:14.307	PRACTICAL	مختبر الطفيليات
54421465-2dd6-45d5-a1bb-224945543a0d	a0c103a8-cb31-4cb9-af84-10cd8cdf3c4b	43897e7f-b159-4093-beac-4a0cc42d5782	3	12:00	14:00	2026-11-11 17:10:14.307	2026-11-11 17:10:14.307	PRACTICAL	مختبر الاحياء
bf694a0f-a455-4a1a-ae9c-a350b09bc1d0	1441e34d-f326-40cf-9d75-0fd96ac3da2f	a47c3505-eca8-478b-9df3-91e5504811fa	3	12:00	14:00	2026-11-11 17:10:14.308	2026-11-11 17:10:14.308	PRACTICAL	مختبر الاحياء
f419cc8d-c981-412e-9b06-8eeaeaaf9dd5	1441e34d-f326-40cf-9d75-0fd96ac3da2f	b35abf9d-5911-405d-85f1-e2700c50cf1d	3	12:00	14:00	2026-11-11 17:10:14.308	2026-11-11 17:10:14.308	PRACTICAL	مختبر الاحياء
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: attendance_user
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
88ddf17a-15f8-4e4b-ba58-f84378f47cb1	76c0dab70fb8307897ef8f958a2713d7fcd144c027d370cddb54640431c4e069	2026-11-06 13:07:12.720252+03	0001_init	\N	\N	2026-11-06 13:07:12.677011+03	1
2e9f7995-d329-417b-8439-97558bad1c30	458193c04cf9213985ea2f5f56751ea34b4106c13f5a3b6c72a8ccfbc2d04b42	2026-11-06 13:07:12.780705+03	0002_online_foundation	\N	\N	2026-11-06 13:07:12.72066+03	1
9cd3effb-1ea3-4c7f-b8fc-a871ec36e271	ce0615118312cc6c016a3e668981fe7c736207044424487654d72486d88d8e3a	2026-11-06 13:07:12.788942+03	0003_staff_management	\N	\N	2026-11-06 13:07:12.781257+03	1
45c8afbf-8584-4dc8-9acd-27d90b484bf4	55ff5df97e597bb02acadb69bde4f4c1d65d438dbe95b2a0eba27ca54799740e	2026-11-06 21:16:07.725817+03	0004_phase2_academics	\N	\N	2026-11-06 21:16:07.576979+03	1
b168cd13-e68b-44c2-9218-8157ecd7769b	60f6c8ad59db416507a723371f6e5e7d5ac5dc58e91dc27f771ee94b34b66373	2026-11-07 19:56:50.249876+03	0005_attendance_identity_and_lecture_archive	\N	\N	2026-11-07 19:56:50.200147+03	1
46f511d4-79e4-403a-9325-fb4080861aef	5e36e2ecf2e7f17737091f8a1003809b806b09649397eae33beab545d575e015	2026-11-09 14:57:11.282958+03	0006_lecture_section_identity	\N	\N	2026-11-09 14:57:11.221477+03	1
306ee718-d17d-4ef2-b2ff-54bed313398a	d255050883c833fb88dba4f1e8600a6bdc753701d64dfe472831fbe821cb1b5c	2026-11-09 15:57:44.130806+03	0007_multi_section_lectures_timetable	\N	\N	2026-11-09 15:57:44.066122+03	1
\.


--
-- Name: AttendanceRecord AttendanceRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."AttendanceRecord"
    ADD CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: Course Course_pkey; Type: CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."Course"
    ADD CONSTRAINT "Course_pkey" PRIMARY KEY (id);


--
-- Name: LectureSection LectureSection_pkey; Type: CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."LectureSection"
    ADD CONSTRAINT "LectureSection_pkey" PRIMARY KEY ("lectureId", "sectionId");


--
-- Name: Lecture Lecture_pkey; Type: CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."Lecture"
    ADD CONSTRAINT "Lecture_pkey" PRIMARY KEY (id);


--
-- Name: Section Section_pkey; Type: CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."Section"
    ADD CONSTRAINT "Section_pkey" PRIMARY KEY (id);


--
-- Name: StaffSession StaffSession_pkey; Type: CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."StaffSession"
    ADD CONSTRAINT "StaffSession_pkey" PRIMARY KEY (id);


--
-- Name: StaffUser StaffUser_pkey; Type: CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."StaffUser"
    ADD CONSTRAINT "StaffUser_pkey" PRIMARY KEY (id);


--
-- Name: StudentQrToken StudentQrToken_pkey; Type: CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."StudentQrToken"
    ADD CONSTRAINT "StudentQrToken_pkey" PRIMARY KEY (id);


--
-- Name: Student Student_pkey; Type: CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."Student"
    ADD CONSTRAINT "Student_pkey" PRIMARY KEY (id);


--
-- Name: SystemSetting SystemSetting_pkey; Type: CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."SystemSetting"
    ADD CONSTRAINT "SystemSetting_pkey" PRIMARY KEY (key);


--
-- Name: TeachingAssignment TeachingAssignment_pkey; Type: CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."TeachingAssignment"
    ADD CONSTRAINT "TeachingAssignment_pkey" PRIMARY KEY (id);


--
-- Name: TimetableEntry TimetableEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."TimetableEntry"
    ADD CONSTRAINT "TimetableEntry_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: AttendanceRecord_lectureId_studentId_key; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE UNIQUE INDEX "AttendanceRecord_lectureId_studentId_key" ON public."AttendanceRecord" USING btree ("lectureId", "studentId");


--
-- Name: AttendanceRecord_studentId_idx; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE INDEX "AttendanceRecord_studentId_idx" ON public."AttendanceRecord" USING btree ("studentId");


--
-- Name: AuditLog_actorUserId_idx; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE INDEX "AuditLog_actorUserId_idx" ON public."AuditLog" USING btree ("actorUserId");


--
-- Name: AuditLog_createdAt_idx; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE INDEX "AuditLog_createdAt_idx" ON public."AuditLog" USING btree ("createdAt");


--
-- Name: Course_stage_code_key; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE UNIQUE INDEX "Course_stage_code_key" ON public."Course" USING btree (stage, code);


--
-- Name: Course_stage_idx; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE INDEX "Course_stage_idx" ON public."Course" USING btree (stage);


--
-- Name: LectureSection_sectionId_idx; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE INDEX "LectureSection_sectionId_idx" ON public."LectureSection" USING btree ("sectionId");


--
-- Name: Lecture_conductedByUserId_idx; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE INDEX "Lecture_conductedByUserId_idx" ON public."Lecture" USING btree ("conductedByUserId");


--
-- Name: Lecture_courseId_idx; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE INDEX "Lecture_courseId_idx" ON public."Lecture" USING btree ("courseId");


--
-- Name: Lecture_createdByUserId_idx; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE INDEX "Lecture_createdByUserId_idx" ON public."Lecture" USING btree ("createdByUserId");


--
-- Name: Lecture_deletedAt_idx; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE INDEX "Lecture_deletedAt_idx" ON public."Lecture" USING btree ("deletedAt");


--
-- Name: Lecture_qrToken_key; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE UNIQUE INDEX "Lecture_qrToken_key" ON public."Lecture" USING btree ("qrToken");


--
-- Name: Lecture_sectionId_idx; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE INDEX "Lecture_sectionId_idx" ON public."Lecture" USING btree ("sectionId");


--
-- Name: Section_stage_studyPeriod_idx; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE INDEX "Section_stage_studyPeriod_idx" ON public."Section" USING btree (stage, "studyPeriod");


--
-- Name: Section_stage_studyPeriod_name_key; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE UNIQUE INDEX "Section_stage_studyPeriod_name_key" ON public."Section" USING btree (stage, "studyPeriod", name);


--
-- Name: StaffSession_expiresAt_idx; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE INDEX "StaffSession_expiresAt_idx" ON public."StaffSession" USING btree ("expiresAt");


--
-- Name: StaffSession_tokenHash_key; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE UNIQUE INDEX "StaffSession_tokenHash_key" ON public."StaffSession" USING btree ("tokenHash");


--
-- Name: StaffSession_userId_idx; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE INDEX "StaffSession_userId_idx" ON public."StaffSession" USING btree ("userId");


--
-- Name: StaffUser_staffId_key; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE UNIQUE INDEX "StaffUser_staffId_key" ON public."StaffUser" USING btree ("staffId");


--
-- Name: StudentQrToken_revokedAt_idx; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE INDEX "StudentQrToken_revokedAt_idx" ON public."StudentQrToken" USING btree ("revokedAt");


--
-- Name: StudentQrToken_studentId_idx; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE INDEX "StudentQrToken_studentId_idx" ON public."StudentQrToken" USING btree ("studentId");


--
-- Name: StudentQrToken_token_key; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE UNIQUE INDEX "StudentQrToken_token_key" ON public."StudentQrToken" USING btree (token);


--
-- Name: Student_deletedAt_idx; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE INDEX "Student_deletedAt_idx" ON public."Student" USING btree ("deletedAt");


--
-- Name: Student_stage_sectionId_idx; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE INDEX "Student_stage_sectionId_idx" ON public."Student" USING btree (stage, "sectionId");


--
-- Name: Student_studentCode_key; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE UNIQUE INDEX "Student_studentCode_key" ON public."Student" USING btree ("studentCode");


--
-- Name: TeachingAssignment_courseId_idx; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE INDEX "TeachingAssignment_courseId_idx" ON public."TeachingAssignment" USING btree ("courseId");


--
-- Name: TeachingAssignment_staffUserId_courseId_key; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE UNIQUE INDEX "TeachingAssignment_staffUserId_courseId_key" ON public."TeachingAssignment" USING btree ("staffUserId", "courseId");


--
-- Name: TimetableEntry_courseId_idx; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE INDEX "TimetableEntry_courseId_idx" ON public."TimetableEntry" USING btree ("courseId");


--
-- Name: TimetableEntry_courseId_sectionId_dayOfWeek_startTime_key; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE UNIQUE INDEX "TimetableEntry_courseId_sectionId_dayOfWeek_startTime_key" ON public."TimetableEntry" USING btree ("courseId", "sectionId", "dayOfWeek", "startTime");


--
-- Name: TimetableEntry_sectionId_dayOfWeek_idx; Type: INDEX; Schema: public; Owner: attendance_user
--

CREATE INDEX "TimetableEntry_sectionId_dayOfWeek_idx" ON public."TimetableEntry" USING btree ("sectionId", "dayOfWeek");


--
-- Name: AttendanceRecord AttendanceRecord_lectureId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."AttendanceRecord"
    ADD CONSTRAINT "AttendanceRecord_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES public."Lecture"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AttendanceRecord AttendanceRecord_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."AttendanceRecord"
    ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AuditLog AuditLog_actorUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES public."StaffUser"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LectureSection LectureSection_lectureId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."LectureSection"
    ADD CONSTRAINT "LectureSection_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES public."Lecture"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LectureSection LectureSection_sectionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."LectureSection"
    ADD CONSTRAINT "LectureSection_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES public."Section"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Lecture Lecture_conductedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."Lecture"
    ADD CONSTRAINT "Lecture_conductedByUserId_fkey" FOREIGN KEY ("conductedByUserId") REFERENCES public."StaffUser"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Lecture Lecture_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."Lecture"
    ADD CONSTRAINT "Lecture_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Lecture Lecture_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."Lecture"
    ADD CONSTRAINT "Lecture_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."StaffUser"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Lecture Lecture_sectionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."Lecture"
    ADD CONSTRAINT "Lecture_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES public."Section"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: StaffSession StaffSession_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."StaffSession"
    ADD CONSTRAINT "StaffSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."StaffUser"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StudentQrToken StudentQrToken_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."StudentQrToken"
    ADD CONSTRAINT "StudentQrToken_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."StaffUser"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: StudentQrToken StudentQrToken_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."StudentQrToken"
    ADD CONSTRAINT "StudentQrToken_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Student Student_sectionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."Student"
    ADD CONSTRAINT "Student_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES public."Section"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TeachingAssignment TeachingAssignment_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."TeachingAssignment"
    ADD CONSTRAINT "TeachingAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TeachingAssignment TeachingAssignment_staffUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."TeachingAssignment"
    ADD CONSTRAINT "TeachingAssignment_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES public."StaffUser"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TimetableEntry TimetableEntry_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."TimetableEntry"
    ADD CONSTRAINT "TimetableEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TimetableEntry TimetableEntry_sectionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: attendance_user
--

ALTER TABLE ONLY public."TimetableEntry"
    ADD CONSTRAINT "TimetableEntry_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES public."Section"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

