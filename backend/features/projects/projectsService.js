// features/projects/projectsService.js
//
// Business logic for Projects.
// Rule: no req/res here — pure data in, data out.
// All queries are scoped to companyId so one tenant can never see another's data.
//
// Access rules:
//   ADMIN     → sees ALL projects in the company
//   ESTIMATOR → sees only projects they created OR are a member of

const prisma = require('../../prisma/client');

// ── List Projects ─────────────────────────────────────────────────────────────

async function listProjects({ companyId, userId, role, status, page = 1, limit = 50 }) {
  const where = {
    companyId,
    ...(status ? { status } : {}),
  };

  // Non-admins: only projects they created or are a member of
  if (role !== 'ADMIN') {
    where.OR = [
      { createdById: userId },
      { members: { some: { userId } } },
    ];
  }

  const [projects, total] = await prisma.$transaction([
    prisma.project.findMany({
      where,
      orderBy: { bidDate: 'asc' },  // always sort by due date ascending
      skip:    (page - 1) * limit,
      take:    limit,
      select: {
        id:               true,
        name:             true,
        location:         true,
        owner:            true,
        gc:               true,
        bidDate:          true,
        status:           true,
        projectType:      true,
        bidValue:         true,
        area:             true,
        submissionStatus: true,
        marginPct:        true,
        notes:            true,
        createdAt:        true,
        updatedAt:        true,
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        // Aggregate estimate totals for manhours + cost rollup
        estimates: {
          select: {
            module:        true,
            totalHours:    true,
            totalCost:     true,
            totalMaterial: true,
            totalLabor:    true,
            totalsJson:    true,
            rowsJson:      true,
          },
        },
        _count: { select: { estimates: true } },
      },
    }),
    prisma.project.count({ where }),
  ]);

  // Compute derived fields per project
  const enriched = projects.map(p => {
    const totalManhours = p.estimates.reduce((s, e) => s + (parseFloat(e.totalHours) || 0), 0);

    // Direct cost = sum of all module totalCosts (excluding SUMMARY which has markup)
    const directCost = p.estimates
      .filter(e => e.module !== 'SUMMARY')
      .reduce((s, e) => s + (parseFloat(e.totalCost) || 0), 0);

    // Bid value = SUMMARY estimate totalCost (includes markup/overhead)
    const summaryEst = p.estimates.find(e => e.module === 'SUMMARY');
    const bidValue   = summaryEst ? (parseFloat(summaryEst.totalCost) || null) : null;

    // Margin % = (bidValue - directCost) / bidValue
    const marginPct  = (bidValue && bidValue > 0 && directCost > 0)
      ? ((bidValue - directCost) / bidValue) * 100
      : null;

    // Extract tonnage: prefer totalsJson.totalTons, then sum coolTons from rowsJson
    let totalTonnage = null;
    const unitEst = p.estimates.find(e => e.module === 'UNIT_SCHEDULE');
    if (unitEst) {
      // Fast path: totalsJson written by new code
      if (unitEst.totalsJson?.totalTons) {
        totalTonnage = parseFloat(unitEst.totalsJson.totalTons) || null;
      } else if (unitEst.rowsJson && typeof unitEst.rowsJson === 'object' && !Array.isArray(unitEst.rowsJson)) {
        // rowsJson = { packagedRows, splitRows, wallMountRows, vrfRows, serviceRows, ... }
        const rowArrays = [
          unitEst.rowsJson.packagedRows,
          unitEst.rowsJson.splitRows,
          unitEst.rowsJson.wallMountRows,
          unitEst.rowsJson.vrfRows,
          unitEst.rowsJson.serviceRows,
        ].filter(Array.isArray);
        const summed = rowArrays.flat().reduce((s, row) => {
          return s + (parseFloat(row.coolTons ?? row.tons ?? row.tonnage ?? 0) || 0);
        }, 0);
        totalTonnage = summed > 0 ? summed : null;
      }
    }

    return {
      ...p,
      totalManhours: totalManhours || null,
      directCost:    directCost    || null,
      bidValue:      bidValue      || null,
      marginPct:     marginPct     != null ? parseFloat(marginPct.toFixed(1)) : null,
      totalTonnage,
      estimates:     undefined,
    };
  });

  return {
    data:  enriched,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

// ── Get Single Project ────────────────────────────────────────────────────────

async function getProject({ id, companyId, userId, role }) {
  const membershipFilter = role !== 'ADMIN'
    ? { OR: [{ createdById: userId }, { members: { some: { userId } } }] }
    : {};

  const project = await prisma.project.findFirst({
    where: { id, companyId, ...membershipFilter },
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      estimates: {
        orderBy: { createdAt: 'desc' },
        select:  { id: true, module: true, totalMaterial: true, totalLabor: true, totalCost: true, updatedAt: true },
      },
      members: {
        select: {
          id:         true,
          assignedAt: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, role: true },
          },
        },
        orderBy: { assignedAt: 'asc' },
      },
      _count: { select: { estimates: true } },
    },
  });

  if (!project) {
    const err = new Error('Project not found.');
    err.status = 404;
    throw err;
  }

  return project;
}

// ── Create Project ────────────────────────────────────────────────────────────

async function createProject({ companyId, createdById, data }) {
  const { name, location, owner, gc, bidDate, notes, projectType, bidValue,
          submissionStatus, area, marginPct,
          companyName, companyAddress, companyPhone, companyEmail } = data;

  const project = await prisma.project.create({
    data: {
      companyId,
      createdById,
      name,
      location:         location         || null,
      owner:            owner            || null,
      gc:               gc               || null,
      bidDate:          bidDate ? new Date(bidDate) : null,
      notes:            notes            || null,
      projectType:      projectType      || null,
      bidValue:         bidValue != null ? Number(bidValue) : null,
      submissionStatus: submissionStatus || null,
      area:             area != null ? Number(area) : null,
      marginPct:        marginPct != null ? Number(marginPct) : null,
      companyName:      companyName      || null,
      companyAddress: companyAddress || null,
      companyPhone:   companyPhone   || null,
      companyEmail:   companyEmail   || null,
    },
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  return project;
}

// ── Clone (Duplicate) Project ─────────────────────────────────────────────────
// Deep-copies a project, its scenarios, estimates, and every line-item row into
// a brand-new project. The copy is reset to a fresh Draft:
//   • status      → ACTIVE
//   • name        → "Copy of <name>"
//   • bidDate / bidValue / submissionStatus → cleared
//   • reports, RFQs, changelogs, members    → NOT copied (start clean)
// Settings overrides and all estimate inputs/results ARE preserved so the
// estimator can adjust an existing bid instead of starting from scratch.

// The isolated per-module item tables, by their Prisma client delegate name.
// We copy these defensively (see below) so the clone keeps working even if the
// generated client predates the isolated-module-tables migration — in that case
// the delegate is simply absent and that table is skipped.
const MODULE_ITEM_DELEGATES = [
  'unitScheduleItem', 'metalDuctItem', 'vavItem', 'electricHeatItem',
  'fanItem', 'louverItem', 'diffuserItem', 'generalItem',
];

// Fields to drop from a copied DB row (regenerated by the new create).
function stripRow(row) {
  const { id, estimateId, createdAt, updatedAt, ...rest } = row;
  return rest;
}

async function cloneProject({ id, companyId, userId, role }) {
  // Reuse the access-controlled lookup so estimators can only clone
  // projects they own or are a member of.
  const membershipFilter = role !== 'ADMIN'
    ? { OR: [{ createdById: userId }, { members: { some: { userId } } }] }
    : {};

  const source = await prisma.project.findFirst({
    where: { id, companyId, ...membershipFilter },
    include: {
      contacts:  true,
      scenarios: true,
      estimates: { include: { rows: true } },
    },
  });

  if (!source) {
    const err = new Error('Project not found.');
    err.status = 404;
    throw err;
  }

  const created = await prisma.$transaction(async (tx) => {
    // 1. New project shell — reset bid-lifecycle fields.
    const project = await tx.project.create({
      data: {
        companyId,
        createdById:      userId,
        name:             `Copy of ${source.name}`,
        location:         source.location,
        owner:            source.owner,
        gc:               source.gc,
        projectType:      source.projectType,
        area:             source.area,
        marginPct:        source.marginPct,
        notes:            source.notes,
        companyName:      source.companyName,
        companyAddress:   source.companyAddress,
        companyPhone:     source.companyPhone,
        companyEmail:     source.companyEmail,
        settingsOverrides: source.settingsOverrides ?? undefined,
        status:           'ACTIVE',
        // Cleared on purpose — this is a fresh draft:
        bidDate:          null,
        bidValue:         null,
        submissionStatus: null,
      },
    });

    // 2. Contacts.
    if (source.contacts.length) {
      await tx.projectContact.createMany({
        data: source.contacts.map((c) => {
          const { id, projectId, ...rest } = c;
          return { ...rest, projectId: project.id };
        }),
      });
    }

    // 3. Scenarios — remember old→new id mapping to relink estimates.
    const scenarioIdMap = {};
    for (const sc of source.scenarios) {
      const newSc = await tx.scenario.create({
        data: {
          projectId: project.id,
          name:      sc.name,
          isDefault: sc.isDefault,
        },
      });
      scenarioIdMap[sc.id] = newSc.id;
    }

    // 4. Estimates + all their rows / module items.
    for (const est of source.estimates) {
      const newEst = await tx.estimate.create({
        data: {
          projectId:     project.id,
          scenarioId:    est.scenarioId ? scenarioIdMap[est.scenarioId] : null,
          createdById:   userId,
          module:        est.module,
          totalMaterial: est.totalMaterial,
          totalLabor:    est.totalLabor,
          totalHours:    est.totalHours,
          totalCost:     est.totalCost,
          settings:      est.settings ?? undefined,
          rowsJson:      est.rowsJson ?? undefined,
          pricesJson:    est.pricesJson ?? undefined,
          totalsJson:    est.totalsJson ?? undefined,
        },
      });

      if (est.rows.length) {
        await tx.estimateRow.createMany({
          data: est.rows.map((r) => ({ ...stripRow(r), estimateId: newEst.id })),
        });
      }

      // Copy the isolated per-module item tables. Guarded by a delegate-exists
      // check so a stale Prisma client (generated before these tables existed)
      // skips them instead of throwing.
      for (const delegate of MODULE_ITEM_DELEGATES) {
        const model = tx[delegate];
        if (!model || typeof model.findMany !== 'function') continue;

        const items = await model.findMany({ where: { estimateId: est.id } });
        if (items.length) {
          await model.createMany({
            data: items.map((it) => ({ ...stripRow(it), estimateId: newEst.id })),
          });
        }
      }
    }

    return project;
  });

  // Return in the same shape as getProject for the frontend.
  return getProject({ id: created.id, companyId, userId, role });
}

// ── Update Project ────────────────────────────────────────────────────────────

async function updateProject({ id, companyId, data }) {
  const existing = await prisma.project.findFirst({ where: { id, companyId } });
  if (!existing) {
    const err = new Error('Project not found.');
    err.status = 404;
    throw err;
  }

  const { name, location, owner, gc, bidDate, notes, status, projectType, bidValue,
          submissionStatus, area, marginPct,
          companyName, companyAddress, companyPhone, companyEmail } = data;

  const updateData = {};
  if (name             !== undefined) updateData.name             = name;
  if (location         !== undefined) updateData.location         = location;
  if (owner            !== undefined) updateData.owner            = owner;
  if (gc               !== undefined) updateData.gc               = gc;
  if (bidDate          !== undefined) updateData.bidDate          = bidDate ? new Date(bidDate) : null;
  if (notes            !== undefined) updateData.notes            = notes;
  if (status           !== undefined) updateData.status           = status;
  if (projectType      !== undefined) updateData.projectType      = projectType || null;
  if (bidValue         !== undefined) updateData.bidValue         = bidValue != null ? Number(bidValue) : null;
  if (submissionStatus !== undefined) updateData.submissionStatus = submissionStatus || null;
  if (area             !== undefined) updateData.area             = area != null ? Number(area) : null;
  if (marginPct        !== undefined) updateData.marginPct        = marginPct != null ? Number(marginPct) : null;
  if (companyName      !== undefined) updateData.companyName      = companyName;
  if (companyAddress!== undefined) updateData.companyAddress = companyAddress;
  if (companyPhone  !== undefined) updateData.companyPhone   = companyPhone;
  if (companyEmail  !== undefined) updateData.companyEmail   = companyEmail;

  const updated = await prisma.project.update({
    where: { id },
    data:  updateData,
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  return updated;
}

// ── Delete Project ────────────────────────────────────────────────────────────

async function deleteProject({ id, companyId }) {
  const existing = await prisma.project.findFirst({ where: { id, companyId } });
  if (!existing) {
    const err = new Error('Project not found.');
    err.status = 404;
    throw err;
  }

  await prisma.project.delete({ where: { id } });
}

// ── List Members ──────────────────────────────────────────────────────────────

async function listMembers({ projectId, companyId }) {
  const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
  if (!project) {
    const err = new Error('Project not found.');
    err.status = 404;
    throw err;
  }

  return prisma.projectMember.findMany({
    where: { projectId },
    select: {
      id:         true,
      assignedAt: true,
      user: {
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
      },
    },
    orderBy: { assignedAt: 'asc' },
  });
}

// ── Assign Member ─────────────────────────────────────────────────────────────

async function assignMember({ projectId, companyId, userId, assignedById }) {
  const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
  if (!project) {
    const err = new Error('Project not found.');
    err.status = 404;
    throw err;
  }

  const user = await prisma.user.findFirst({ where: { id: userId, companyId } });
  if (!user) {
    const err = new Error('User not found in this company.');
    err.status = 404;
    throw err;
  }

  const member = await prisma.projectMember.upsert({
    where:  { projectId_userId: { projectId, userId } },
    update: { assignedById },
    create: { projectId, userId, assignedById },
    select: {
      id:         true,
      assignedAt: true,
      user: {
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
      },
    },
  });

  return member;
}

// ── Remove Member ─────────────────────────────────────────────────────────────

async function removeMember({ projectId, companyId, userId }) {
  const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
  if (!project) {
    const err = new Error('Project not found.');
    err.status = 404;
    throw err;
  }

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!existing) {
    const err = new Error('Member not found on this project.');
    err.status = 404;
    throw err;
  }

  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId, userId } },
  });
}

// ── Project Settings Overrides ────────────────────────────────────────────────
// Estimators can override company-wide pricing/rates on a per-project basis.
// These overrides are stored on the Project row itself (settingsOverrides JSON).
// Company PricingConfig is NEVER modified by these functions.

async function getProjectSettingsOverrides({ id, companyId, userId, role }) {
  // Reuse getProject so access rules are enforced
  const project = await getProject({ id, companyId, userId, role });
  return project.settingsOverrides || {};
}

async function saveProjectSettingsOverrides({ id, companyId, userId, role, overrides }) {
  // Verify access first
  await getProject({ id, companyId, userId, role });

  // Only allow valid keys — mirrors PricingConfig fields
  const ALLOWED_KEYS = [
    'ratePackaged','rateSplit','rateWallMount','rateVrf','rateFan','rateDuct','ratePipe','rateElec',
    'overheadPct','profitPct','taxPct','ductWastePct','pipeWastePct',
    'copperSettings','accessoryPriceOverrides',
    'ductPrices','diffuserSettings','fanSettings','elecHeatSettings',
  ];
  const sanitized = {};
  for (const key of ALLOWED_KEYS) {
    if (overrides[key] !== undefined) sanitized[key] = overrides[key];
  }

  const updated = await prisma.project.update({
    where: { id },
    data:  { settingsOverrides: sanitized },
    select: { id: true, settingsOverrides: true },
  });
  return updated.settingsOverrides || {};
}

async function resetProjectSettingsOverrides({ id, companyId, userId, role }) {
  // Verify access first
  await getProject({ id, companyId, userId, role });

  await prisma.project.update({
    where: { id },
    data:  { settingsOverrides: null },
  });
}

module.exports = {
  listProjects,
  getProject,
  createProject,
  cloneProject,
  updateProject,
  deleteProject,
  listMembers,
  assignMember,
  removeMember,
  getProjectSettingsOverrides,
  saveProjectSettingsOverrides,
  resetProjectSettingsOverrides,
};
