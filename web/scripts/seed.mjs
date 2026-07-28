/**
 * Seeds the Firebase Local Emulator Suite with a demo workspace so the app
 * is immediately usable. Run `firebase emulators:start` first (or use
 * `npm run dev:emulators` which runs both), then `npm run seed`.
 *
 * Demo login: demo@founderos.app / founderos123
 */
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({ projectId: "demo-founderos" });
const auth = getAuth();
const db = getFirestore();

const DEMO_EMAIL = "demo@founderos.app";
const DEMO_PASSWORD = "founderos123";
const DEMO_NAME = "Humayra Shajahan";

async function getOrCreateDemoUser() {
  try {
    const existing = await auth.getUserByEmail(DEMO_EMAIL);
    console.log(`Using existing demo user ${existing.uid}`);
    return existing;
  } catch {
    const created = await auth.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      displayName: DEMO_NAME,
    });
    console.log(`Created demo user ${created.uid}`);
    return created;
  }
}

function daysAgo(n) {
  return Date.now() - n * 86400000;
}
function daysFromNow(n) {
  return Date.now() + n * 86400000;
}

async function main() {
  const user = await getOrCreateDemoUser();
  const ts = Date.now();

  const pointerRef = db.doc(`userWorkspaces/${user.uid}`);
  const pointerSnap = await pointerRef.get();
  let workspaceId;

  if (pointerSnap.exists) {
    workspaceId = pointerSnap.data().primaryWorkspaceId;
    console.log(`Using existing workspace ${workspaceId}`);
  } else {
    const workspaceRef = db.collection("workspaces").doc();
    workspaceId = workspaceRef.id;
    const batch = db.batch();
    batch.set(workspaceRef, {
      name: "Humayra's Workspace",
      slug: workspaceId,
      createdAt: ts,
      createdBy: user.uid,
    });
    batch.set(db.doc(`workspaces/${workspaceId}/members/${user.uid}`), {
      workspaceId,
      email: DEMO_EMAIL,
      displayName: DEMO_NAME,
      role: "owner",
      createdAt: ts,
    });
    batch.set(pointerRef, { primaryWorkspaceId: workspaceId });
    await batch.commit();
    console.log(`Created workspace ${workspaceId}`);
  }

  const companiesCol = db.collection(`workspaces/${workspaceId}/companies`);
  const existingCompanies = await companiesCol.get();
  if (!existingCompanies.empty) {
    console.log("Companies already seeded, skipping data seed.");
    console.log(`\nDemo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
    return;
  }

  const companies = [
    {
      key: "nimbus",
      name: "Nimbus Analytics",
      industry: "SaaS / Data",
      type: "startup",
      status: "active",
      stage: "growth",
      currency: "USD",
      color: "#2563EB",
    },
    {
      key: "kiln",
      name: "Kiln & Co",
      industry: "D2C / Home Goods",
      type: "startup",
      status: "active",
      stage: "launched",
      currency: "GBP",
      color: "#F97316",
    },
    {
      key: "pathlight",
      name: "Pathlight Tutors",
      industry: "EdTech",
      type: "startup",
      status: "exploring",
      stage: "pre-launch",
      currency: "USD",
      color: "#8B5CF6",
    },
  ];

  const companyIds = {};
  for (const c of companies) {
    const ref = companiesCol.doc();
    companyIds[c.key] = ref.id;
    await ref.set({
      workspaceId,
      name: c.name,
      industry: c.industry,
      type: c.type,
      status: c.status,
      stage: c.stage,
      currency: c.currency,
      color: c.color,
      founder: DEMO_NAME,
      createdAt: ts,
      updatedAt: ts,
      archivedAt: null,
    });
  }
  console.log(`Seeded ${companies.length} companies`);

  const projectsCol = db.collection(`workspaces/${workspaceId}/projects`);
  const projectDefs = [
    { key: "dashboard", company: "nimbus", name: "Analytics Dashboard v2", priority: "high", status: "in_progress", estimatedHours: 320 },
    { key: "onboarding", company: "nimbus", name: "Self-Serve Onboarding", priority: "critical", status: "in_progress", estimatedHours: 180 },
    { key: "winter", company: "kiln", name: "Winter Collection Launch", priority: "high", status: "in_progress", estimatedHours: 260 },
    { key: "warehouse", company: "kiln", name: "Warehouse Automation", priority: "medium", status: "in_progress", estimatedHours: 150 },
    { key: "mvp", company: "pathlight", name: "MVP Marketplace Build", priority: "critical", status: "in_progress", estimatedHours: 400 },
  ];
  const projectIds = {};
  for (const p of projectDefs) {
    const ref = projectsCol.doc();
    projectIds[p.key] = ref.id;
    await ref.set({
      workspaceId,
      companyId: companyIds[p.company],
      name: p.name,
      priority: p.priority,
      status: p.status,
      estimatedHours: p.estimatedHours,
      createdAt: ts,
      updatedAt: ts,
    });
  }
  console.log(`Seeded ${projectDefs.length} projects`);

  const tasksCol = db.collection(`workspaces/${workspaceId}/tasks`);
  const taskDefs = [
    { company: "nimbus", project: "dashboard", title: "Rewrite query layer for Postgres partitioning", status: "in_progress", priority: "high", due: daysFromNow(5) },
    { company: "nimbus", project: "dashboard", title: "Add caching layer for dashboard widgets", status: "not_started", priority: "medium", due: daysFromNow(12) },
    { company: "nimbus", project: "dashboard", title: "Fix chart rendering bug on Safari", status: "completed", priority: "high", due: daysAgo(10) },
    { company: "nimbus", project: "onboarding", title: "Redesign signup flow wireframes", status: "completed", priority: "critical", due: daysAgo(3) },
    { company: "nimbus", project: "onboarding", title: "Build interactive product tour", status: "in_progress", priority: "high", due: daysFromNow(8) },
    { company: "nimbus", project: null, title: "Draft SOC 2 security policy docs", status: "not_started", priority: "medium", due: daysFromNow(20) },
    { company: "kiln", project: "winter", title: "Photograph winter collection lookbook", status: "in_progress", priority: "high", due: daysFromNow(2) },
    { company: "kiln", project: "winter", title: "Negotiate supplier pricing for glaze materials", status: "in_progress", priority: "high", due: daysAgo(1) },
    { company: "kiln", project: "warehouse", title: "Evaluate 3 warehouse automation vendors", status: "in_progress", priority: "medium", due: daysFromNow(6) },
    { company: "kiln", project: null, title: "Launch paid social campaign", status: "not_started", priority: "critical", due: daysFromNow(15) },
    { company: "pathlight", project: "mvp", title: "Build tutor profile + search UI", status: "in_progress", priority: "critical", due: daysAgo(2) },
    { company: "pathlight", project: "mvp", title: "Implement booking + payments flow", status: "not_started", priority: "critical", due: daysFromNow(18) },
    { company: "pathlight", project: null, title: "Interview 15 tutors on marketplace expectations", status: "in_review", priority: "high", due: daysFromNow(3) },
  ];
  const taskIds = [];
  let order = 0;
  for (const t of taskDefs) {
    const ref = tasksCol.doc();
    taskIds.push({ id: ref.id, company: t.company });
    await ref.set({
      workspaceId,
      companyId: companyIds[t.company],
      projectId: t.project ? projectIds[t.project] : null,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.due,
      completedAt: t.status === "completed" ? daysAgo(1) : null,
      order: order++,
      createdAt: ts,
      updatedAt: ts,
    });
  }
  console.log(`Seeded ${taskDefs.length} tasks`);

  const timeCol = db.collection(`workspaces/${workspaceId}/timeEntries`);
  let logged = 0;
  for (const [i, t] of taskIds.entries()) {
    if (i % 2 !== 0) continue; // log time against every other task
    const startedAt = daysAgo(i + 1);
    const endedAt = startedAt + (1.5 + (i % 3)) * 3_600_000;
    await timeCol.add({
      workspaceId,
      companyId: companyIds[t.company],
      taskId: t.id,
      memberId: user.uid,
      startedAt,
      endedAt,
      billable: true,
      createdAt: ts,
    });
    logged++;
  }
  console.log(`Seeded ${logged} time entries`);

  console.log(`\nDemo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
