'use strict';

const prisma = require('../prisma-client');
const createError = require('http-errors');
const ERROR_CODES = require('../constant/error-codes.js');
const { Groups } = require('../common/models.common.js');

/**
 * List audits for a group (company)
 */
async function findByGroup({ groupId }) {
  return prisma.audit.findMany({
    where: { companyId: groupId },
    orderBy: { createdAt: 'desc' },
    include: {
      inventoryItems: {
        select: {
          category: true,
        },
        distinct: ['category'],
      },
    },
  });
}

/**
 * Create a new audit
 */
async function createAudit({ companyId, userId, name, status }) {
  console.log('[audit.service] createAudit called with:', {
    companyId,
    userId,
    name,
    status,
  });

  // Verify that the company exists in MongoDB
  const group = await Groups.findById(companyId);
  if (!group) {
    console.error('[audit.service] Group not found:', companyId);
    throw createError.NotFound(ERROR_CODES.GROUP_NOT_FOUND);
  }
  console.log('[audit.service] Group found:', group.name);

  // Check if deliverability module is enabled for this company
  if (!group.enableDeliverability) {
    console.error(
      '[audit.service] Deliverability not enabled for group:',
      group.name
    );
    throw createError.Forbidden(
      'Deliverability module is not enabled for this company'
    );
  }

  console.log('[audit.service] Creating audit in PostgreSQL...');
  const audit = await prisma.audit.create({
    data: {
      companyId,
      userId,
      name,
      status: status || 'DRAFT',
      organization: 'Badsender', // Default organization
    },
  });
  console.log('[audit.service] Audit created in DB:', audit);

  return audit;
}

/**
 * Find audit by ID
 */
async function findById({ auditId }) {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    include: {
      inventoryItems: true,
    },
  });

  if (!audit) {
    throw createError.NotFound(ERROR_CODES.AUDIT_NOT_FOUND);
  }

  return audit;
}

/**
 * Update audit
 */
async function updateAudit({ auditId, data }) {
  return prisma.audit.update({
    where: { id: auditId },
    data,
  });
}

/**
 * Delete audit
 */
async function deleteAudit({ auditId }) {
  return prisma.audit.delete({
    where: { id: auditId },
  });
}

/**
 * Check if user is authorized to access an audit
 */
async function checkIfUserIsAuthorizedToAccessAudit({ user, auditId }) {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
  });

  if (!audit) {
    throw createError.NotFound(ERROR_CODES.AUDIT_NOT_FOUND);
  }

  // Super admins can access all audits
  if (user.isAdmin) {
    return audit;
  }

  // Get user's group ID - can be a string, ObjectId, or object with id/_id
  const userGroupId =
    typeof user.group === 'string'
      ? user.group
      : user.group.id || user.group._id || user.group.toString();

  // Regular users can only access audits from their company
  if (audit.companyId !== userGroupId) {
    throw createError.Forbidden(ERROR_CODES.UNAUTHORIZED_ACCESS);
  }

  return audit;
}

const CATEGORY_TO_PROGRESS_FIELD = {
  PLATFORM: 'progressPlatforms',
  USAGE: 'progressUsages',
  DISPLAY_FROM_DOMAIN: 'progressDisplayFromDomains',
  DISPLAY_FROM_ADDRESS: 'progressDisplayFromAddresses',
  REPLY_TO: 'progressReplyTos',
  MAIL_FROM_DOMAIN: 'progressMailFromDomains',
  TRACKING_DOMAIN: 'progressTrackingDomains',
  HOSTING_DOMAIN: 'progressHostingDomains',
  IP: 'progressIps',
  LINK_DESTINATION_DOMAIN: 'progressLinkDestinationDomains',
};

/**
 * Update inventory progress for a specific step
 */
async function updateInventoryProgress({ auditId, step, completed }) {
  const progressField = CATEGORY_TO_PROGRESS_FIELD[step.toUpperCase()];

  if (!progressField) {
    throw createError.BadRequest(`Unknown inventory category: ${step}`);
  }

  return prisma.audit.update({
    where: { id: auditId },
    data: {
      [progressField]: completed,
    },
  });
}

module.exports = {
  findByGroup,
  createAudit,
  findById,
  updateAudit,
  deleteAudit,
  checkIfUserIsAuthorizedToAccessAudit,
  updateInventoryProgress,
};
