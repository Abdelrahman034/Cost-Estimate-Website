// features/projects/projectSubService.js
//
// Sub-resources nested under a project:
//   ProjectContact  — people attached to the project
//   ProjectChangelog — audit trail of changes
//   Report           — generated PDF records

const prisma = require('../../prisma/client');

async function assertProject(projectId, companyId) {
  const p = await prisma.project.findFirst({ where: { id: projectId, companyId } });
  if (!p) { const e = new Error('Project not found.'); e.status = 404; throw e; }
  return p;
}

// ── Contacts ──────────────────────────────────────────────────────────────────

async function listContacts({ projectId, companyId }) {
  await assertProject(projectId, companyId);
  return prisma.projectContact.findMany({
    where:   { projectId },
    orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
  });
}

async function createContact({ projectId, companyId, data }) {
  await assertProject(projectId, companyId);
  const { name, role, email, phone, isPrimary = false } = data;
  if (!name) { const e = new Error('name is required.'); e.status = 400; throw e; }

  // If marking primary, demote any existing primary
  if (isPrimary) {
    await prisma.projectContact.updateMany({ where: { projectId, isPrimary: true }, data: { isPrimary: false } });
  }

  return prisma.projectContact.create({
    data: { projectId, name, role: role||null, email: email||null, phone: phone||null, isPrimary },
  });
}

async function updateContact({ id, projectId, companyId, data }) {
  await assertProject(projectId, companyId);
  const existing = await prisma.projectContact.findFirst({ where: { id, projectId } });
  if (!existing) { const e = new Error('Contact not found.'); e.status = 404; throw e; }

  const { name, role, email, phone, isPrimary } = data;
  const payload = {};
  if (name      !== undefined) payload.name      = name;
  if (role      !== undefined) payload.role      = role;
  if (email     !== undefined) payload.email     = email;
  if (phone     !== undefined) payload.phone     = phone;
  if (isPrimary !== undefined) payload.isPrimary = isPrimary;

  if (isPrimary === true) {
    await prisma.projectContact.updateMany({ where: { projectId, isPrimary: true }, data: { isPrimary: false } });
  }

  return prisma.projectContact.update({ where: { id }, data: payload });
}

async function deleteContact({ id, projectId, companyId }) {
  await assertProject(projectId, companyId);
  const existing = await prisma.projectContact.findFirst({ where: { id, projectId } });
  if (!existing) { const e = new Error('Contact not found.'); e.status = 404; throw e; }
  await prisma.projectContact.delete({ where: { id } });
}

// ── Changelog ─────────────────────────────────────────────────────────────────

async function listChangelog({ projectId, companyId, limit = 50 }) {
  await assertProject(projectId, companyId);
  return prisma.projectChangelog.findMany({
    where:   { projectId },
    orderBy: { createdAt: 'desc' },
    take:    limit,
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
}

async function addChangelogEntry({ projectId, companyId, userId, data }) {
  await assertProject(projectId, companyId);
  const { action, detail } = data;
  if (!action) { const e = new Error('action is required.'); e.status = 400; throw e; }
  return prisma.projectChangelog.create({
    data: { projectId, userId: userId || null, action, detail: detail || null },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
}

// ── Reports ───────────────────────────────────────────────────────────────────

async function listReports({ projectId, companyId }) {
  await assertProject(projectId, companyId);
  return prisma.report.findMany({
    where:   { projectId, companyId },
    orderBy: { createdAt: 'desc' },
    select:  { id: true, type: true, filename: true, storagePath: true,
               totalBid: true, metadata: true, createdAt: true },
  });
}

async function createReport({ projectId, companyId, data }) {
  await assertProject(projectId, companyId);
  const { type, filename, storagePath, totalBid, metadata } = data;
  if (!type || !filename) { const e = new Error('type and filename are required.'); e.status = 400; throw e; }
  return prisma.report.create({
    data: { companyId, projectId, type, filename, storagePath: storagePath||null,
            totalBid: totalBid||null, metadata: metadata||null },
  });
}

async function deleteReport({ id, projectId, companyId }) {
  await assertProject(projectId, companyId);
  const existing = await prisma.report.findFirst({ where: { id, projectId, companyId } });
  if (!existing) { const e = new Error('Report not found.'); e.status = 404; throw e; }
  await prisma.report.delete({ where: { id } });
}

module.exports = {
  listContacts, createContact, updateContact, deleteContact,
  listChangelog, addChangelogEntry,
  listReports, createReport, deleteReport,
};
