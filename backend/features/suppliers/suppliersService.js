// features/suppliers/suppliersService.js

const prisma = require('../../prisma/client');

// ── Guard helpers ─────────────────────────────────────────────────────────────

async function assertSupplier(id, companyId) {
  const s = await prisma.supplier.findFirst({ where: { id, companyId } });
  if (!s) { const e = new Error('Supplier not found.'); e.status = 404; throw e; }
  return s;
}

async function assertRfq(id, companyId) {
  const r = await prisma.rfq.findFirst({ where: { id, companyId } });
  if (!r) { const e = new Error('RFQ not found.'); e.status = 404; throw e; }
  return r;
}

// ── Suppliers ─────────────────────────────────────────────────────────────────

async function listSuppliers({ companyId }) {
  return prisma.supplier.findMany({
    where:   { companyId, isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, company: true,
      email: true, phone: true, notes: true, isActive: true,
      createdAt: true, updatedAt: true,
    },
  });
}

async function createSupplier({ companyId, data }) {
  const { name, company, email, phone, notes } = data;
  if (!name) { const e = new Error('name is required.'); e.status = 400; throw e; }
  return prisma.supplier.create({
    data: { companyId, name, company: company || null, email: email || null, phone: phone || null, notes: notes || null },
  });
}

async function updateSupplier({ id, companyId, data }) {
  await assertSupplier(id, companyId);
  const { name, company, email, phone, notes, isActive } = data;
  const payload = {};
  if (name     !== undefined) payload.name     = name;
  if (company  !== undefined) payload.company  = company;
  if (email    !== undefined) payload.email    = email;
  if (phone    !== undefined) payload.phone    = phone;
  if (notes    !== undefined) payload.notes    = notes;
  if (isActive !== undefined) payload.isActive = isActive;
  return prisma.supplier.update({ where: { id }, data: payload });
}

async function deleteSupplier({ id, companyId }) {
  await assertSupplier(id, companyId);
  // Soft delete — mark inactive
  await prisma.supplier.update({ where: { id }, data: { isActive: false } });
}

// ── RFQs ──────────────────────────────────────────────────────────────────────

async function listRfqs({ companyId, projectId }) {
  return prisma.rfq.findMany({
    where: { companyId, ...(projectId ? { projectId } : {}) },
    orderBy: { createdAt: 'desc' },
    include: {
      suppliers: {
        include: { supplier: { select: { id: true, name: true, email: true } } },
      },
      _count: { select: { quotes: true } },
    },
  });
}

async function createRfq({ companyId, data }) {
  const { title, projectId, projectName, itemsJson, dueDate, notes, supplierIds = [] } = data;
  if (!title) { const e = new Error('title is required.'); e.status = 400; throw e; }

  // Verify all supplierIds belong to this company
  if (supplierIds.length) {
    const count = await prisma.supplier.count({
      where: { id: { in: supplierIds }, companyId },
    });
    if (count !== supplierIds.length) {
      const e = new Error('One or more supplierIds are invalid.'); e.status = 400; throw e;
    }
  }

  return prisma.rfq.create({
    data: {
      companyId,
      title,
      projectId:   projectId   || null,
      projectName: projectName || null,
      itemsJson:   itemsJson   || [],
      dueDate:     dueDate ? new Date(dueDate) : null,
      notes:       notes       || null,
      suppliers: {
        create: supplierIds.map(sid => ({ supplierId: sid })),
      },
    },
    include: {
      suppliers: {
        include: { supplier: { select: { id: true, name: true, email: true } } },
      },
    },
  });
}

async function updateRfq({ id, companyId, data }) {
  await assertRfq(id, companyId);
  const { title, projectName, itemsJson, status, sentAt, dueDate, notes, supplierIds } = data;

  const payload = {};
  if (title       !== undefined) payload.title       = title;
  if (projectName !== undefined) payload.projectName = projectName;
  if (itemsJson   !== undefined) payload.itemsJson   = itemsJson;
  if (status      !== undefined) payload.status      = status;
  if (sentAt      !== undefined) payload.sentAt      = sentAt ? new Date(sentAt) : null;
  if (dueDate     !== undefined) payload.dueDate     = dueDate ? new Date(dueDate) : null;
  if (notes       !== undefined) payload.notes       = notes;

  // Re-sync suppliers if provided
  if (supplierIds !== undefined) {
    payload.suppliers = {
      deleteMany: {},
      create: supplierIds.map(sid => ({ supplierId: sid })),
    };
  }

  return prisma.rfq.update({
    where: { id },
    data:  payload,
    include: {
      suppliers: {
        include: { supplier: { select: { id: true, name: true, email: true } } },
      },
    },
  });
}

async function deleteRfq({ id, companyId }) {
  await assertRfq(id, companyId);
  await prisma.rfq.delete({ where: { id } });
}

// ── Supplier Quotes ───────────────────────────────────────────────────────────

async function listQuotes({ rfqId, companyId }) {
  await assertRfq(rfqId, companyId);
  return prisma.supplierQuote.findMany({
    where: { rfqId },
    include: { supplier: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

async function upsertQuote({ rfqId, supplierId, companyId, data }) {
  await assertRfq(rfqId, companyId);
  const { linesJson, subtotal, notes, status, receivedAt } = data;

  const existing = await prisma.supplierQuote.findUnique({
    where: { rfqId_supplierId: { rfqId, supplierId } },
  });

  const payload = {
    linesJson:  linesJson  ?? [],
    subtotal:   subtotal   ?? null,
    notes:      notes      ?? null,
    status:     status     ?? 'PENDING',
    receivedAt: receivedAt ? new Date(receivedAt) : null,
  };

  if (existing) {
    return prisma.supplierQuote.update({ where: { id: existing.id }, data: payload });
  }
  return prisma.supplierQuote.create({ data: { rfqId, supplierId, ...payload } });
}

module.exports = {
  listSuppliers, createSupplier, updateSupplier, deleteSupplier,
  listRfqs, createRfq, updateRfq, deleteRfq,
  listQuotes, upsertQuote,
};
