const pool = require('../db/pool');
const { SLA_MINUTES, REQUESTER_ROLES } = require('../config/constants');

// GET /api/catalog — list active catalog items (with fields)
async function getCatalogItems(req, res) {
  const { rows: items } = await pool.query(
    `SELECT * FROM catalog_items WHERE is_active = TRUE ORDER BY sort_order, name`
  );

  const { rows: fields } = await pool.query(
    `SELECT * FROM catalog_fields
     WHERE catalog_item_id = ANY($1)
     ORDER BY catalog_item_id, sort_order`,
    [items.map((i) => i.id)]
  );

  const fieldsByItem = {};
  for (const f of fields) {
    if (!fieldsByItem[f.catalog_item_id]) fieldsByItem[f.catalog_item_id] = [];
    fieldsByItem[f.catalog_item_id].push(f);
  }

  const result = items.map((item) => ({
    ...item,
    fields: fieldsByItem[item.id] || [],
  }));

  res.json({ items: result });
}

// GET /api/catalog/:id
async function getCatalogItem(req, res) {
  const {
    rows: [item],
  } = await pool.query(`SELECT * FROM catalog_items WHERE id = $1 AND is_active = TRUE`, [
    req.params.id,
  ]);
  if (!item) return res.status(404).json({ error: 'Catalog item not found' });

  const { rows: fields } = await pool.query(
    `SELECT * FROM catalog_fields WHERE catalog_item_id = $1 ORDER BY sort_order`,
    [item.id]
  );

  res.json({ item: { ...item, fields } });
}

// POST /api/catalog/:id/submit — create ticket from catalog item
async function submitCatalogItem(req, res) {
  const {
    rows: [item],
  } = await pool.query(`SELECT * FROM catalog_items WHERE id = $1 AND is_active = TRUE`, [
    req.params.id,
  ]);
  if (!item) return res.status(404).json({ error: 'Catalog item not found' });

  const { body, additionalInfo } = req.body;
  const isRequester = REQUESTER_ROLES.includes(req.user.role);

  // Build description from submitted field values
  let description = '';
  if (body && typeof body === 'object') {
    const entries = Object.entries(body)
      .filter(([, v]) => v !== '' && v !== null && v !== undefined)
      .map(([k, v]) => `**${k.replace(/_/g, ' ')}:** ${v}`);
    description = entries.join('\n');
  }
  if (additionalInfo) description += `\n\n**Additional info:** ${additionalInfo}`;
  if (!description.trim()) description = `Request for: ${item.name}`;

  const requesterName = isRequester ? req.user.name : req.body.requesterName || req.user.name;
  const requesterEmail = isRequester ? req.user.email : req.body.requesterEmail || req.user.email;
  const priority = isRequester ? 'P3' : item.default_priority || 'P3';
  const slaMinutes = SLA_MINUTES[priority] || SLA_MINUTES.P3;
  const initialStatus = item.requires_approval ? 'Pending Approval' : 'New';

  const {
    rows: [ticket],
  } = await pool.query(
    `INSERT INTO tickets
       (title, description, type, priority, sla_minutes, status, source,
        requester_name, requester_email,
        created_by_user_id, catalog_item_id)
     VALUES ($1,$2,'Service Request',$3,$4,$5,'catalog',$6,$7,$8,$9)
     RETURNING *`,
    [
      item.name,
      description.trim(),
      priority,
      slaMinutes,
      initialStatus,
      requesterName,
      requesterEmail,
      req.user.userId,
      item.id,
    ]
  );

  // Notify all managers + admins about the new service request
  const { rows: managers } = await pool.query(
    `SELECT id FROM users WHERE role IN ('admin','manager') AND is_active = TRUE`
  );

  if (item.requires_approval) {
    // Create approval record
    await pool.query(`INSERT INTO approvals (ticket_id) VALUES ($1)`, [ticket.id]);

    const approvalMsg = `Approval needed: "${item.name}" requested by ${requesterName}.`;
    await Promise.all(
      managers.map((m) =>
        pool.query(
          `INSERT INTO notifications (user_id, ticket_id, type, message) VALUES ($1,$2,'approval_needed',$3)`,
          [m.id, ticket.id, approvalMsg]
        )
      )
    );
  } else {
    // No approval needed — still notify staff a new request arrived
    const newMsg = `New service request: "${item.name}" submitted by ${requesterName}.`;
    await Promise.all(
      managers.map((m) =>
        pool.query(
          `INSERT INTO notifications (user_id, ticket_id, type, message) VALUES ($1,$2,'new_ticket',$3)`,
          [m.id, ticket.id, newMsg]
        )
      )
    );
  }

  res.status(201).json({ ticket });
}

module.exports = { getCatalogItems, getCatalogItem, submitCatalogItem };
