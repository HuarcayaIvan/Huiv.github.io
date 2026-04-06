const STORAGE_KEY = "pedido-accesorios-v1";
const tabButtons = Array.from(document.querySelectorAll(".tab-button"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));

const defaultState = {
  order: {
    client: "",
    number: "",
    includeDistribution: true,
    quickMode: false,
    exportScope: "all",
    selectedPackagingIds: []
  },
  filters: {
    query: "",
    type: "all",
    exportSelectionQuery: ""
  },
  catalog: [],
  packaging: [
    { id: crypto.randomUUID(), name: "Pallet Principal", type: "Pallet", parentId: "" },
    { id: crypto.randomUUID(), name: "Caja 1", type: "Caja", parentId: "" }
  ],
  items: [
    { id: crypto.randomUUID(), code: "", quantity: 12, description: "Manijas cromadas", packagingId: "" }
  ]
};

defaultState.packaging[1].parentId = defaultState.packaging[0].id;
defaultState.items[0].packagingId = defaultState.packaging[1].id;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultState;
    }

    const parsed = JSON.parse(raw);
    return {
      order: {
        client: parsed?.order?.client || "",
        number: parsed?.order?.number || "",
        includeDistribution: parsed?.order?.includeDistribution !== false,
        quickMode: parsed?.order?.quickMode === true,
        exportScope: parsed?.order?.exportScope || "all",
        selectedPackagingIds: Array.isArray(parsed?.order?.selectedPackagingIds) ? parsed.order.selectedPackagingIds : []
      },
      filters: {
        query: parsed?.filters?.query || "",
        type: parsed?.filters?.type || "all",
        exportSelectionQuery: parsed?.filters?.exportSelectionQuery || ""
      },
      catalog: Array.isArray(parsed?.catalog) ? parsed.catalog : [],
      packaging: Array.isArray(parsed?.packaging) && parsed.packaging.length ? parsed.packaging : defaultState.packaging,
      items: Array.isArray(parsed?.items)
        ? parsed.items.map((item) => ({ ...item, code: item?.code || "" }))
        : defaultState.items
    };
  } catch {
    return defaultState;
  }
}

let state = loadState();
let autosaveTimer = null;

const orderClientInput = document.querySelector("#order-client");
const orderNumberInput = document.querySelector("#order-number");
const includeDistributionInput = document.querySelector("#include-distribution");
const quickModeInput = document.querySelector("#quick-mode");
const exportScopeInput = document.querySelector("#export-scope");
const exportSelectionBox = document.querySelector("#export-selection-box");
const exportSelectionList = document.querySelector("#export-selection-list");
const exportSelectionSearchInput = document.querySelector("#export-selection-search");
const clearExportSelectionButton = document.querySelector("#clear-export-selection");
const selectAllExportButton = document.querySelector("#select-all-export");
const selectPalletsExportButton = document.querySelector("#select-pallets-export");
const selectBoxesExportButton = document.querySelector("#select-boxes-export");
const selectBundlesExportButton = document.querySelector("#select-bundles-export");
const autosaveStatus = document.querySelector("#autosave-status");
const searchQueryInput = document.querySelector("#search-query");
const filterTypeInput = document.querySelector("#filter-type");
const packagingForm = document.querySelector("#packaging-form");
const packagingIdInput = document.querySelector("#packaging-id");
const packagingNameInput = document.querySelector("#packaging-name");
const packagingTypeInput = document.querySelector("#packaging-type");
const packagingParentSelect = document.querySelector("#packaging-parent");
const packagingSubmit = document.querySelector("#packaging-submit");
const packagingCancel = document.querySelector("#packaging-cancel");
const itemForm = document.querySelector("#item-form");
const itemIdInput = document.querySelector("#item-id");
const itemQuantityInput = document.querySelector("#item-quantity");
const itemCodeInput = document.querySelector("#item-code");
const itemDescriptionInput = document.querySelector("#item-description");
const itemPackagingSelect = document.querySelector("#item-packaging");
const itemSubmit = document.querySelector("#item-submit");
const itemCancel = document.querySelector("#item-cancel");
const summaryTree = document.querySelector("#summary-tree");
const distributionTree = document.querySelector("#distribution-tree");
const distributionSection = document.querySelector("#distribution-section");
const distributionChip = document.querySelector("#distribution-chip");
const validationBox = document.querySelector("#validation-box");
const totalItems = document.querySelector("#total-items");
const totalPieces = document.querySelector("#total-pieces");
const totalPackaging = document.querySelector("#total-packaging");
const summaryDate = document.querySelector("#summary-date");
const summaryClient = document.querySelector("#summary-client");
const summaryOrder = document.querySelector("#summary-order");
const newOrderButton = document.querySelector("#new-order");
const exportCsvButton = document.querySelector("#export-csv");
const importCsvButton = document.querySelector("#import-csv");
const csvFileInput = document.querySelector("#csv-file-input");
const exportImageButton = document.querySelector("#export-image");
const exportPdfButton = document.querySelector("#export-pdf");
const importCatalogButton = document.querySelector("#import-catalog");
const clearCatalogButton = document.querySelector("#clear-catalog");
const catalogFileInput = document.querySelector("#catalog-file-input");
const catalogStatus = document.querySelector("#catalog-status");
const catalogCodes = document.querySelector("#catalog-codes");
const catalogDescriptions = document.querySelector("#catalog-descriptions");

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  autosaveStatus.textContent = `Guardado automático: ${new Intl.DateTimeFormat("es-AR", { timeStyle: "short" }).format(new Date())}`;
}

function queueSave() {
  window.clearTimeout(autosaveTimer);
  autosaveStatus.textContent = "Guardando...";
  autosaveTimer = window.setTimeout(saveState, 250);
}

function refreshDate() {
  summaryDate.textContent = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "full",
    timeStyle: "short"
  }).format(new Date());
}

function packagingLabel(packaging) {
  return `${packaging.type} - ${packaging.name}`;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function packagingPrefix(type) {
  const map = {
    Pallet: "PAL",
    Caja: "CAJ",
    Bulto: "BUL",
    Contenedor: "CON",
    Otro: "EMB"
  };
  return map[type] || "EMB";
}

function packagingRank(type) {
  const ranks = {
    Contenedor: 5,
    Pallet: 4,
    Bulto: 3,
    Caja: 2,
    Otro: 1
  };
  return ranks[type] || 1;
}

function isDescendant(candidateId, targetId) {
  let currentId = candidateId;

  while (currentId) {
    if (currentId === targetId) {
      return true;
    }
    const current = state.packaging.find((entry) => entry.id === currentId);
    currentId = current?.parentId || "";
  }

  return false;
}

function updateSelects() {
  const currentEditingPackagingId = packagingIdInput.value;

  const packagingParentOptions = state.packaging
    .filter((entry) => !currentEditingPackagingId || entry.id !== currentEditingPackagingId)
    .filter((entry) => !currentEditingPackagingId || !isDescendant(entry.id, currentEditingPackagingId))
    .map((entry) => `<option value="${entry.id}">${packagingLabel(entry)}</option>`)
    .join("");

  const packagingOptions = state.packaging
    .map((entry) => `<option value="${entry.id}">${packagingLabel(entry)}</option>`)
    .join("");

  packagingParentSelect.innerHTML = `<option value="">Sin embalaje padre</option>${packagingParentOptions}`;
  itemPackagingSelect.innerHTML = `<option value="">Seleccionar</option>${packagingOptions}`;
}

function buildTree() {
  const byParent = new Map();

  state.packaging.forEach((entry) => {
    const parentKey = entry.parentId || "root";
    const siblings = byParent.get(parentKey) || [];
    siblings.push(entry);
    byParent.set(parentKey, siblings);
  });

  return byParent;
}

function buildCodeMap(tree) {
  const codeMap = new Map();

  function visit(nodes, parentCode = "") {
    nodes.forEach((node, index) => {
      const ownCode = `${packagingPrefix(node.type)}-${String(index + 1).padStart(3, "0")}`;
      const fullCode = parentCode ? `${parentCode}.${ownCode}` : ownCode;
      codeMap.set(node.id, fullCode);
      visit(tree.get(node.id) || [], fullCode);
    });
  }

  visit(tree.get("root") || []);
  return codeMap;
}

function getItemCode(codeMap, item, index) {
  const packagingCode = codeMap.get(item.packagingId) || "SIN-EMB";
  return `${packagingCode}-MAT-${String(index + 1).padStart(2, "0")}`;
}

function getActiveFilters() {
  return {
    query: normalizeText(state.filters.query),
    type: state.filters.type || "all"
  };
}

function getItemsForPackaging(packagingId) {
  return state.items.filter((item) => item.packagingId === packagingId);
}

function getExportRoots(tree) {
  const selected = state.order.selectedPackagingIds.filter((id) => (
    state.order.exportScope === "selected" ? state.packaging.some((entry) => entry.id === id) : true
  ));

  if (state.order.exportScope !== "selected" || !selected.length) {
    return tree.get("root") || [];
  }

  return state.packaging.filter((entry) => (
    selected.includes(entry.id) &&
    !selected.some((otherId) => otherId !== entry.id && isDescendant(entry.parentId, otherId))
  ));
}

function getVisiblePackagingIds(tree, roots) {
  const visible = new Set();

  function visit(node) {
    visible.add(node.id);
    (tree.get(node.id) || []).forEach(visit);
  }

  roots.forEach(visit);
  return visible;
}

function resetPackagingForm() {
  packagingForm.reset();
  packagingIdInput.value = "";
  packagingSubmit.textContent = "Agregar";
  packagingCancel.classList.add("hidden");
  updateSelects();
}

function resetItemForm() {
  itemForm.reset();
  itemIdInput.value = "";
  itemSubmit.textContent = "Agregar";
  itemCancel.classList.add("hidden");
}

function createFreshState() {
  const freshState = {
    order: {
      client: "",
      number: "",
      includeDistribution: true,
      quickMode: false,
      exportScope: "all",
      selectedPackagingIds: []
    },
    filters: {
      query: "",
      type: "all",
      exportSelectionQuery: ""
    },
    catalog: [],
    packaging: [
      { id: crypto.randomUUID(), name: "Pallet Principal", type: "Pallet", parentId: "" },
      { id: crypto.randomUUID(), name: "Caja 1", type: "Caja", parentId: "" }
    ],
    items: [
      { id: crypto.randomUUID(), code: "", quantity: 12, description: "Manijas cromadas", packagingId: "" }
    ]
  };

  freshState.packaging[1].parentId = freshState.packaging[0].id;
  freshState.items[0].packagingId = freshState.packaging[1].id;
  return freshState;
}

function setOrderSummary() {
  summaryClient.textContent = state.order.client.trim() || "Sin cliente";
  summaryOrder.textContent = state.order.number.trim() || "Sin orden";
  distributionChip.textContent = state.order.includeDistribution ? "Esquema incluido" : "Esquema oculto";
  distributionSection.classList.toggle("hidden-section", !state.order.includeDistribution);
  exportSelectionBox.classList.toggle("hidden-section", state.order.exportScope !== "selected");
  document.body.classList.toggle("quick-mode", state.order.quickMode);
}

function collectValidations(tree) {
  const warnings = [];

  state.packaging.forEach((packaging) => {
    const siblingDuplicates = state.packaging.filter((entry) => (
      entry.parentId === packaging.parentId &&
      entry.id !== packaging.id &&
      normalizeText(entry.name) === normalizeText(packaging.name)
    ));

    if (siblingDuplicates.length) {
      warnings.push(`Hay embalajes duplicados con el nombre "${packaging.name}" en el mismo nivel.`);
    }
  });

  state.packaging.forEach((packaging) => {
    const childCount = (tree.get(packaging.id) || []).length;
    const itemCount = getItemsForPackaging(packaging.id).length;
    if (!childCount && !itemCount) {
      warnings.push(`El embalaje "${packaging.name}" está vacío.`);
    }

    if (packaging.parentId && !isValidPackagingParent(packaging.type, packaging.parentId)) {
      warnings.push(`La estructura de "${packaging.name}" es inválida por tamaño respecto a su embalaje padre.`);
    }
  });

  state.items.forEach((item) => {
    const duplicatedItems = state.items.filter((entry) => (
      entry.id !== item.id &&
      entry.packagingId === item.packagingId &&
      normalizeText(entry.description) === normalizeText(item.description)
    ));

    if (duplicatedItems.length) {
      warnings.push(`Hay materiales repetidos en el mismo embalaje: "${item.description}".`);
    }
  });

  return [...new Set(warnings)];
}

function renderValidations(tree) {
  const validations = collectValidations(tree);
  validationBox.classList.toggle("hidden-section", validations.length === 0);
  validationBox.innerHTML = validations.length
    ? validations.map((message) => `<div>${message}</div>`).join("")
    : "";
}

function isValidPackagingParent(childType, parentId) {
  if (!parentId) {
    return true;
  }

  const parent = state.packaging.find((entry) => entry.id === parentId);
  if (!parent) {
    return true;
  }

  return packagingRank(parent.type) > packagingRank(childType);
}

function renderExportSelection(tree, codeMap) {
  const query = normalizeText(state.filters.exportSelectionQuery);
  const packagingList = state.packaging.filter((packaging) => {
    if (!query) {
      return true;
    }

    const haystack = normalizeText(`${codeMap.get(packaging.id) || ""} ${packaging.type} ${packaging.name}`);
    return haystack.includes(query);
  });

  exportSelectionList.innerHTML = packagingList.length
    ? packagingList.map((packaging) => `
        <label class="selection-item">
          <input
            type="checkbox"
            data-export-packaging="${packaging.id}"
            ${state.order.selectedPackagingIds.includes(packaging.id) ? "checked" : ""}
          >
          <span>${codeMap.get(packaging.id) || ""} · ${packaging.type} · ${packaging.name}</span>
        </label>
      `).join("")
    : `<div class="empty-inline">No hay embalajes cargados.</div>`;
}

function renderCatalog() {
  catalogCodes.innerHTML = state.catalog.map((entry) => (
    `<option value="${entry.code}">${entry.description}</option>`
  )).join("");

  catalogDescriptions.innerHTML = state.catalog.map((entry) => (
    `<option value="${entry.description}">${entry.code}</option>`
  )).join("");

  catalogStatus.textContent = state.catalog.length
    ? `Catálogo cargado: ${state.catalog.length} artículos`
    : "Sin catálogo cargado";
}

function activateTab(targetId) {
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tabTarget === targetId);
  });

  tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === targetId);
  });
}

function findCatalogByCode(code) {
  return state.catalog.find((entry) => normalizeText(entry.code) === normalizeText(code));
}

function findCatalogByDescription(description) {
  return state.catalog.find((entry) => normalizeText(entry.description) === normalizeText(description));
}

function editPackaging(packagingId) {
  const packaging = state.packaging.find((entry) => entry.id === packagingId);
  if (!packaging) {
    return;
  }

  packagingIdInput.value = packaging.id;
  packagingNameInput.value = packaging.name;
  packagingTypeInput.value = packaging.type;
  updateSelects();
  packagingParentSelect.value = packaging.parentId;
  packagingSubmit.textContent = "Guardar";
  packagingCancel.classList.remove("hidden");
  packagingNameInput.focus();
}

function deletePackaging(packagingId) {
  const descendants = new Set([packagingId]);
  let foundNew = true;

  while (foundNew) {
    foundNew = false;
    state.packaging.forEach((entry) => {
      if (!descendants.has(entry.id) && descendants.has(entry.parentId)) {
        descendants.add(entry.id);
        foundNew = true;
      }
    });
  }

  const usedByItems = state.items.some((item) => descendants.has(item.packagingId));
  if (usedByItems) {
    window.alert("No se puede eliminar porque ese embalaje o sus hijos contienen materiales.");
    return;
  }

  state.packaging = state.packaging.filter((entry) => !descendants.has(entry.id));
  resetPackagingForm();
  updateSelects();
  renderSummary();
  queueSave();
}

function editItem(itemId) {
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item) {
    return;
  }

  itemIdInput.value = item.id;
  itemQuantityInput.value = item.quantity;
  itemCodeInput.value = item.code || "";
  itemDescriptionInput.value = item.description;
  itemPackagingSelect.value = item.packagingId;
  itemSubmit.textContent = "Guardar";
  itemCancel.classList.remove("hidden");
  itemDescriptionInput.focus();
}

function deleteItem(itemId) {
  state.items = state.items.filter((entry) => entry.id !== itemId);
  resetItemForm();
  renderSummary();
  queueSave();
}

function packagingActionMarkup(packagingId) {
  return `
    <div class="row-actions">
      <button type="button" class="mini-button" data-action="edit-packaging" data-id="${packagingId}">Editar</button>
      <button type="button" class="mini-button danger" data-action="delete-packaging" data-id="${packagingId}">Borrar</button>
    </div>
  `;
}

function itemActionMarkup(itemId) {
  return `
    <div class="row-actions">
      <button type="button" class="mini-button" data-action="edit-item" data-id="${itemId}">Editar</button>
      <button type="button" class="mini-button danger" data-action="delete-item" data-id="${itemId}">Borrar</button>
    </div>
  `;
}

function packagingMatches(packaging, codeMap, filters) {
  if (filters.type === "items") {
    return false;
  }

  if (!filters.query) {
    return true;
  }

  const haystack = normalizeText([
    packaging.name,
    packaging.type,
    codeMap.get(packaging.id) || ""
  ].join(" "));

  return haystack.includes(filters.query);
}

function itemMatches(item, codeMap, itemCode, packaging, filters) {
  if (filters.type === "packaging") {
    return false;
  }

  if (!filters.query) {
    return true;
  }

  const haystack = normalizeText([
    item.code || "",
    item.description,
    item.quantity,
    itemCode,
    packaging.name,
    codeMap.get(packaging.id) || ""
  ].join(" "));

  return haystack.includes(filters.query);
}

function renderPackagingNode(packaging, tree, codeMap, filters, depth = 0) {
  const items = getItemsForPackaging(packaging.id);
  const children = tree.get(packaging.id) || [];
  const visibleItems = items
    .map((item, index) => ({ item, itemCode: getItemCode(codeMap, item, index) }))
    .filter(({ item, itemCode }) => itemMatches(item, codeMap, itemCode, packaging, filters));
  const visibleChildren = children
    .map((child) => renderPackagingNode(child, tree, codeMap, filters, depth + 1))
    .filter(Boolean);
  const packagingVisible = packagingMatches(packaging, codeMap, filters);

  if (!packagingVisible && !visibleItems.length && !visibleChildren.length) {
    return "";
  }

  const itemsMarkup = visibleItems.length
    ? `<div class="item-list">${visibleItems.map(({ item, itemCode }) => `
        <article class="material-row" draggable="true" data-drag-type="item" data-item-id="${item.id}">
          <div class="material-main">
            <strong>${item.quantity} pcs · ${itemCode}</strong>
            <span>${item.code ? `${item.code} · ` : ""}${item.description}</span>
          </div>
          ${itemActionMarkup(item.id)}
        </article>
      `).join("")}</div>`
    : `<div class="empty-inline">Sin materiales visibles</div>`;

  const childrenMarkup = visibleChildren.length
    ? `<div class="child-packaging-list">${visibleChildren.join("")}</div>`
    : "";

  return `
    <details class="packaging-node" style="--depth:${depth}" draggable="true" data-drag-type="packaging" data-packaging-id="${packaging.id}" data-drop-target="${packaging.id}" ${depth < 1 ? "open" : ""}>
      <summary class="packaging-heading">
        <div class="packaging-main">
          <span class="count-badge subtle">${codeMap.get(packaging.id) || ""}</span>
          <span class="packaging-tag">${packaging.type}</span>
          <h4>${packaging.name}</h4>
        </div>
        <div class="packaging-tools">
          <span class="count-badge">${items.length}</span>
          <span class="summary-caret">Ver</span>
        </div>
      </summary>
      <div class="packaging-content">
        <div class="inline-edit-bar">
          ${packagingActionMarkup(packaging.id)}
        </div>
        ${itemsMarkup}
        ${childrenMarkup}
      </div>
    </details>
  `;
}

function renderDistributionNode(packaging, tree, codeMap) {
  const children = tree.get(packaging.id) || [];
  return `
    <div class="distribution-node">
      <div class="distribution-pill">
        <strong>${codeMap.get(packaging.id) || ""} · ${packaging.name}</strong>
        <span>${packaging.type}</span>
      </div>
      ${children.length ? `<div class="distribution-children">${children.map((child) => renderDistributionNode(child, tree, codeMap)).join("")}</div>` : ""}
    </div>
  `;
}

function renderSummary() {
  refreshDate();
  setOrderSummary();
  renderCatalog();
  totalItems.textContent = String(state.items.length);
  totalPieces.textContent = String(state.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0));
  totalPackaging.textContent = String(state.packaging.length);

  if (!state.packaging.length) {
    renderValidations(new Map());
    summaryTree.innerHTML = `<div class="empty-inline">Creá un embalaje para empezar.</div>`;
    distributionTree.innerHTML = `<div class="empty-inline">Sin estructura para mostrar.</div>`;
    return;
  }

  const tree = buildTree();
  const codeMap = buildCodeMap(tree);
  const filters = getActiveFilters();
  const roots = getExportRoots(tree);
  renderValidations(tree);
  renderExportSelection(tree, codeMap);
  const renderedRoots = roots.map((rootNode) => renderPackagingNode(rootNode, tree, codeMap, filters)).filter(Boolean);

  summaryTree.innerHTML = roots.length
    ? renderedRoots.length
      ? `<div class="dropzone-root" data-drop-root="true">Soltá acá para dejar un embalaje en nivel principal</div>${renderedRoots.join("")}`
      : `<div class="empty-inline">No hay resultados para el filtro actual.</div>`
    : `<div class="empty-inline">Revisá la estructura del embalaje.</div>`;

  distributionTree.innerHTML = roots.length
    ? roots.map((rootNode) => renderDistributionNode(rootNode, tree, codeMap)).join("")
    : `<div class="empty-inline">Sin estructura para mostrar.</div>`;
}

function wrapText(context, text, maxWidth, x, y, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      context.fillText(line, x, currentY);
      currentY += lineHeight;
      line = word;
      return;
    }
    line = candidate;
  });

  if (line) {
    context.fillText(line, x, currentY);
    currentY += lineHeight;
  }

  return currentY;
}

function drawDetailSection(context, packaging, tree, codeMap, startY, depth) {
  const indent = depth * 26;
  const items = getItemsForPackaging(packaging.id);
  const children = tree.get(packaging.id) || [];
  let currentY = startY;

  context.fillStyle = "#1f2a37";
  context.font = "700 16px Aptos, Segoe UI, sans-serif";
  context.fillText(`${codeMap.get(packaging.id) || ""} · ${packaging.type}: ${packaging.name}`, 54 + indent, currentY);
  currentY += 24;

  if (!items.length) {
    context.fillStyle = "#6a7280";
    context.font = "500 13px Aptos, Segoe UI, sans-serif";
    context.fillText("Sin materiales", 54 + indent, currentY);
    currentY += 20;
  } else {
    items.forEach((item, index) => {
      context.fillStyle = "#1f2a37";
      context.font = "700 13px Aptos, Segoe UI, sans-serif";
      context.fillText(`${item.quantity} pcs · ${getItemCode(codeMap, item, index)}`, 54 + indent, currentY);
      context.font = "500 13px Aptos, Segoe UI, sans-serif";
      currentY = wrapText(
        context,
        `${item.code ? `${item.code} · ` : ""}${item.description}`,
        560 - indent,
        116 + indent,
        currentY,
        18
      );
      currentY += 4;
    });
  }

  children.forEach((child) => {
    currentY += 8;
    currentY = drawDetailSection(context, child, tree, codeMap, currentY, depth + 1);
  });

  return currentY + 8;
}

function drawDistribution(context, packaging, tree, codeMap, x, y, depth) {
  const children = tree.get(packaging.id) || [];
  const width = 180;
  const boxHeight = 46;
  const currentX = x + depth * 46;

  context.fillStyle = "#f7efe5";
  context.strokeStyle = "#d9c0a7";
  context.lineWidth = 1.5;
  context.beginPath();
  context.roundRect(currentX, y, width, boxHeight, 12);
  context.fill();
  context.stroke();

  context.fillStyle = "#1f2a37";
  context.font = "700 13px Aptos, Segoe UI, sans-serif";
  context.fillText(codeMap.get(packaging.id) || "", currentX + 12, y + 16);
  context.font = "500 12px Aptos, Segoe UI, sans-serif";
  context.fillText(`${packaging.type} · ${packaging.name}`, currentX + 12, y + 33);

  let nextY = y + boxHeight + 18;
  children.forEach((child) => {
    const childX = x + (depth + 1) * 46;
    context.strokeStyle = "#b6542c";
    context.beginPath();
    context.moveTo(currentX + width, y + boxHeight / 2);
    context.lineTo(currentX + width + 14, y + boxHeight / 2);
    context.lineTo(currentX + width + 14, nextY + boxHeight / 2);
    context.lineTo(childX, nextY + boxHeight / 2);
    context.stroke();
    nextY = drawDistribution(context, child, tree, codeMap, x, nextY, depth + 1);
  });

  return Math.max(nextY, y + boxHeight + 10);
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === "\"" && inQuotes && nextChar === "\"") {
      current += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function exportAsCsv() {
  const tree = buildTree();
  const roots = getExportRoots(tree);
  const visiblePackagingIds = getVisiblePackagingIds(tree, roots);
  const visibleItems = state.items.filter((item) => visiblePackagingIds.has(item.packagingId));
  const lines = [];
  lines.push("META,client,number,includeDistribution,quickMode");
  lines.push([
    "META",
    escapeCsv(state.order.client),
    escapeCsv(state.order.number),
    state.order.includeDistribution ? "1" : "0",
    state.order.quickMode ? "1" : "0"
  ].join(","));

  lines.push("PACKAGING,id,name,type,parentId");
  state.packaging.filter((packaging) => visiblePackagingIds.has(packaging.id)).forEach((packaging) => {
    lines.push([
      "PACKAGING",
      escapeCsv(packaging.id),
      escapeCsv(packaging.name),
      escapeCsv(packaging.type),
      escapeCsv(packaging.parentId)
    ].join(","));
  });

  lines.push("ITEM,id,code,quantity,description,packagingId");
  visibleItems.forEach((item) => {
    lines.push([
      "ITEM",
      escapeCsv(item.id),
      escapeCsv(item.code || ""),
      escapeCsv(item.quantity),
      escapeCsv(item.description),
      escapeCsv(item.packagingId)
    ].join(","));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "pedido-accesorios.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function importFromCsv(text) {
  const rows = text.split(/\r?\n/).filter(Boolean);
  const nextState = createFreshState();
  nextState.catalog = state.catalog;
  nextState.packaging = [];
  nextState.items = [];

  rows.forEach((row) => {
    const [type, ...rest] = parseCsvLine(row);
    if (type === "META" && rest[0] !== "client") {
      nextState.order.client = rest[0] || "";
      nextState.order.number = rest[1] || "";
      nextState.order.includeDistribution = rest[2] !== "0";
      nextState.order.quickMode = rest[3] === "1";
    }

    if (type === "PACKAGING" && rest[0] !== "id") {
      nextState.packaging.push({
        id: rest[0],
        name: rest[1],
        type: rest[2],
        parentId: rest[3] || ""
      });
    }

    if (type === "ITEM" && rest[0] !== "id") {
      const hasCodeColumn = rest.length >= 5;
      nextState.items.push({
        id: rest[0],
        code: hasCodeColumn ? (rest[1] || "") : "",
        quantity: Number(hasCodeColumn ? rest[2] : rest[1]),
        description: hasCodeColumn ? rest[3] : rest[2],
        packagingId: hasCodeColumn ? (rest[4] || "") : (rest[3] || "")
      });
    }
  });

  if (!nextState.packaging.length) {
    throw new Error("El archivo CSV no contiene embalajes válidos.");
  }

  state = nextState;
  orderClientInput.value = state.order.client;
  orderNumberInput.value = state.order.number;
  includeDistributionInput.checked = state.order.includeDistribution;
  quickModeInput.checked = state.order.quickMode;
  searchQueryInput.value = state.filters.query;
  filterTypeInput.value = state.filters.type;
  resetPackagingForm();
  resetItemForm();
  updateSelects();
  renderSummary();
  saveState();
}

function importCatalogCsv(text) {
  const rows = text.split(/\r?\n/).filter(Boolean);
  const entries = [];

  rows.forEach((row, index) => {
    const [first, second] = parseCsvLine(row);
    if (index === 0 && normalizeText(first) === "codigo" && normalizeText(second) === "descripcion") {
      return;
    }

    if (first && second) {
      entries.push({
        code: first.trim(),
        description: second.trim()
      });
    }
  });

  if (!entries.length) {
    throw new Error("El catálogo debe tener al menos dos columnas: codigo y descripcion.");
  }

  state.catalog = entries;
  renderCatalog();
  queueSave();
}

function readCatalogWorkbook(file) {
  if (typeof XLSX === "undefined") {
    throw new Error("La importación de Excel no está disponible en este navegador.");
  }

  return file.arrayBuffer().then((buffer) => {
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

    const entries = [];
    rows.forEach((row, index) => {
      const code = String(row[0] || "").trim();
      const description = String(row[1] || "").trim();

      if (index === 0 && normalizeText(code) === "codigo" && normalizeText(description) === "descripcion") {
        return;
      }

      if (code && description) {
        entries.push({ code, description });
      }
    });

    if (!entries.length) {
      throw new Error("El archivo Excel debe tener columnas codigo y descripcion.");
    }

    state.catalog = entries;
    renderCatalog();
    queueSave();
  });
}

function exportAsImage() {
  const tree = buildTree();
  const codeMap = buildCodeMap(tree);
  const roots = getExportRoots(tree);
  const includeDistribution = state.order.includeDistribution;
  const canvas = document.createElement("canvas");
  canvas.width = includeDistribution ? 1500 : 900;
  canvas.height = Math.max(1000, 260 + state.items.length * 70 + state.packaging.length * 90);

  const context = canvas.getContext("2d");
  context.fillStyle = "#fffdf9";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#1f2a37";
  context.font = "800 30px Aptos, Segoe UI, sans-serif";
  context.fillText("Resumen del pedido", 44, 56);
  context.font = "500 15px Aptos, Segoe UI, sans-serif";
  context.fillStyle = "#6a7280";
  context.fillText(`Cliente: ${state.order.client || "Sin cliente"}`, 44, 88);
  context.fillText(`Orden: ${state.order.number || "Sin orden"}`, 44, 110);
  context.fillText(`Fecha: ${summaryDate.textContent}`, 44, 132);

  let detailY = 180;
  roots.forEach((rootPackaging) => {
    detailY = drawDetailSection(context, rootPackaging, tree, codeMap, detailY, 0);
    detailY += 12;
  });

  if (includeDistribution) {
    context.fillStyle = "#1f2a37";
    context.font = "700 22px Aptos, Segoe UI, sans-serif";
    context.fillText("Distribución", 860, 56);

    let distributionY = 100;
    roots.forEach((rootPackaging) => {
      distributionY = drawDistribution(context, rootPackaging, tree, codeMap, 860, distributionY, 0);
      distributionY += 16;
    });
  }

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = "pedido-accesorios.png";
  link.click();
}

packagingForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const packagingId = packagingIdInput.value;
  const nextPackaging = {
    id: packagingId || crypto.randomUUID(),
    name: packagingNameInput.value.trim(),
    type: packagingTypeInput.value,
    parentId: packagingParentSelect.value
  };

  if (!nextPackaging.name) {
    return;
  }

  const duplicatedPackaging = state.packaging.find((entry) => (
    entry.id !== packagingId &&
    entry.parentId === nextPackaging.parentId &&
    normalizeText(entry.name) === normalizeText(nextPackaging.name)
  ));

  if (duplicatedPackaging) {
    window.alert("Ya existe un embalaje con ese nombre en el mismo nivel.");
    return;
  }

  if (!isValidPackagingParent(nextPackaging.type, nextPackaging.parentId)) {
    window.alert("Ese embalaje no puede ubicarse dentro del embalaje padre elegido por tamaño.");
    return;
  }

  if (packagingId) {
    state.packaging = state.packaging.map((entry) => entry.id === packagingId ? nextPackaging : entry);
  } else {
    state.packaging.push(nextPackaging);
  }

  resetPackagingForm();
  updateSelects();
  renderSummary();
  queueSave();
});

itemForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const itemId = itemIdInput.value;
  const nextItem = {
    id: itemId || crypto.randomUUID(),
    code: itemCodeInput.value.trim(),
    quantity: Number(itemQuantityInput.value),
    description: itemDescriptionInput.value.trim(),
    packagingId: itemPackagingSelect.value
  };

  if (!nextItem.packagingId || !nextItem.description || !nextItem.quantity) {
    return;
  }

  const duplicatedItem = state.items.find((entry) => (
    entry.id !== itemId &&
    entry.packagingId === nextItem.packagingId &&
    normalizeText(entry.description) === normalizeText(nextItem.description)
  ));

  if (duplicatedItem) {
    window.alert("Ya existe un material con esa descripción dentro del mismo embalaje.");
    return;
  }

  if (itemId) {
    state.items = state.items.map((entry) => entry.id === itemId ? nextItem : entry);
  } else {
    state.items.push(nextItem);
  }

  resetItemForm();
  renderSummary();
  queueSave();
});

packagingCancel.addEventListener("click", resetPackagingForm);
itemCancel.addEventListener("click", resetItemForm);

orderClientInput.addEventListener("input", () => {
  state.order.client = orderClientInput.value;
  setOrderSummary();
  queueSave();
});

orderNumberInput.addEventListener("input", () => {
  state.order.number = orderNumberInput.value;
  setOrderSummary();
  queueSave();
});

includeDistributionInput.addEventListener("change", () => {
  state.order.includeDistribution = includeDistributionInput.checked;
  setOrderSummary();
  queueSave();
});

exportScopeInput.addEventListener("change", () => {
  state.order.exportScope = exportScopeInput.value;
  if (state.order.exportScope !== "selected") {
    state.order.selectedPackagingIds = [];
  }
  renderSummary();
  queueSave();
});

clearExportSelectionButton.addEventListener("click", () => {
  state.order.selectedPackagingIds = [];
  renderSummary();
  queueSave();
});

selectAllExportButton.addEventListener("click", () => {
  state.order.selectedPackagingIds = state.packaging.map((packaging) => packaging.id);
  renderSummary();
  queueSave();
});

selectPalletsExportButton.addEventListener("click", () => {
  state.order.selectedPackagingIds = state.packaging
    .filter((packaging) => packaging.type === "Pallet")
    .map((packaging) => packaging.id);
  renderSummary();
  queueSave();
});

selectBoxesExportButton.addEventListener("click", () => {
  state.order.selectedPackagingIds = state.packaging
    .filter((packaging) => packaging.type === "Caja")
    .map((packaging) => packaging.id);
  renderSummary();
  queueSave();
});

selectBundlesExportButton.addEventListener("click", () => {
  state.order.selectedPackagingIds = state.packaging
    .filter((packaging) => packaging.type === "Bulto")
    .map((packaging) => packaging.id);
  renderSummary();
  queueSave();
});

quickModeInput.addEventListener("change", () => {
  state.order.quickMode = quickModeInput.checked;
  setOrderSummary();
  queueSave();
});

searchQueryInput.addEventListener("input", () => {
  state.filters.query = searchQueryInput.value;
  renderSummary();
  queueSave();
});

filterTypeInput.addEventListener("change", () => {
  state.filters.type = filterTypeInput.value;
  renderSummary();
  queueSave();
});

itemCodeInput.addEventListener("input", () => {
  const match = findCatalogByCode(itemCodeInput.value);
  if (match) {
    itemDescriptionInput.value = match.description;
  }
});

itemDescriptionInput.addEventListener("input", () => {
  const match = findCatalogByDescription(itemDescriptionInput.value);
  if (match && !itemCodeInput.value.trim()) {
    itemCodeInput.value = match.code;
  }
});

exportSelectionSearchInput.addEventListener("input", () => {
  state.filters.exportSelectionQuery = exportSelectionSearchInput.value;
  renderSummary();
  queueSave();
});

newOrderButton.addEventListener("click", () => {
  const confirmed = window.confirm("Se va a limpiar el pedido actual y el guardado automático. ¿Querés continuar?");
  if (!confirmed) {
    return;
  }

  window.clearTimeout(autosaveTimer);
  const catalogSnapshot = state.catalog;
  state = createFreshState();
  state.catalog = catalogSnapshot;
  localStorage.removeItem(STORAGE_KEY);

  orderClientInput.value = state.order.client;
  orderNumberInput.value = state.order.number;
  includeDistributionInput.checked = state.order.includeDistribution;
  quickModeInput.checked = state.order.quickMode;
  exportScopeInput.value = state.order.exportScope;
  searchQueryInput.value = state.filters.query;
  filterTypeInput.value = state.filters.type;
  exportSelectionSearchInput.value = state.filters.exportSelectionQuery;
  resetPackagingForm();
  resetItemForm();
  updateSelects();
  renderSummary();
  saveState();
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activateTab(button.dataset.tabTarget);
  });
});

summaryTree.addEventListener("dragstart", (event) => {
  const packagingNode = event.target.closest("[data-drag-type='packaging']");
  const itemNode = event.target.closest("[data-drag-type='item']");

  if (packagingNode) {
    event.dataTransfer.setData("text/plain", JSON.stringify({
      type: "packaging",
      id: packagingNode.dataset.packagingId
    }));
  } else if (itemNode) {
    event.dataTransfer.setData("text/plain", JSON.stringify({
      type: "item",
      id: itemNode.dataset.itemId
    }));
  }
});

summaryTree.addEventListener("dragover", (event) => {
  if (event.target.closest("[data-drop-target]") || event.target.closest("[data-drop-root]")) {
    event.preventDefault();
  }
});

summaryTree.addEventListener("drop", (event) => {
  const targetPackaging = event.target.closest("[data-drop-target]");
  const rootDropzone = event.target.closest("[data-drop-root]");
  if (!targetPackaging && !rootDropzone) {
    return;
  }

  event.preventDefault();
  const raw = event.dataTransfer.getData("text/plain");
  if (!raw) {
    return;
  }

  const data = JSON.parse(raw);

  if (data.type === "item" && targetPackaging) {
    state.items = state.items.map((item) => (
      item.id === data.id ? { ...item, packagingId: targetPackaging.dataset.dropTarget } : item
    ));
    renderSummary();
    queueSave();
    return;
  }

  if (data.type === "packaging") {
    const targetId = rootDropzone ? "" : targetPackaging.dataset.dropTarget;
    if (data.id === targetId || isDescendant(targetId, data.id)) {
      return;
    }

    const movingPackaging = state.packaging.find((packaging) => packaging.id === data.id);
    if (movingPackaging && !isValidPackagingParent(movingPackaging.type, targetId)) {
      window.alert("No se puede mover ese embalaje dentro del destino elegido por tamaño.");
      return;
    }

    state.packaging = state.packaging.map((packaging) => (
      packaging.id === data.id ? { ...packaging, parentId: targetId } : packaging
    ));
    renderSummary();
    queueSave();
  }
});

summaryTree.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const { action, id } = button.dataset;
  if (action === "edit-item") {
    editItem(id);
  } else if (action === "delete-item") {
    deleteItem(id);
  } else if (action === "edit-packaging") {
    editPackaging(id);
  } else if (action === "delete-packaging") {
    deletePackaging(id);
  }
});

exportSelectionList.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-export-packaging]");
  if (!checkbox) {
    return;
  }

  const packagingId = checkbox.dataset.exportPackaging;
  if (checkbox.checked) {
    if (!state.order.selectedPackagingIds.includes(packagingId)) {
      state.order.selectedPackagingIds.push(packagingId);
    }
  } else {
    state.order.selectedPackagingIds = state.order.selectedPackagingIds.filter((id) => id !== packagingId);
  }

  renderSummary();
  queueSave();
});

exportCsvButton.addEventListener("click", exportAsCsv);
importCsvButton.addEventListener("click", () => csvFileInput.click());
importCatalogButton.addEventListener("click", () => catalogFileInput.click());
clearCatalogButton.addEventListener("click", () => {
  state.catalog = [];
  renderCatalog();
  queueSave();
});
csvFileInput.addEventListener("change", async () => {
  const [file] = csvFileInput.files;
  if (!file) {
    return;
  }

  try {
    const content = await file.text();
    importFromCsv(content);
  } catch (error) {
    window.alert(error.message || "No se pudo importar el archivo.");
  } finally {
    csvFileInput.value = "";
  }
});

catalogFileInput.addEventListener("change", async () => {
  const [file] = catalogFileInput.files;
  if (!file) {
    return;
  }

  try {
    if (file.name.toLowerCase().endsWith(".xlsx")) {
      await readCatalogWorkbook(file);
    } else {
      const content = await file.text();
      importCatalogCsv(content);
    }
  } catch (error) {
    window.alert(error.message || "No se pudo importar el catálogo.");
  } finally {
    catalogFileInput.value = "";
  }
});

exportImageButton.addEventListener("click", () => {
  activateTab("workspace-tab");
  exportAsImage();
});

exportPdfButton.addEventListener("click", () => {
  activateTab("workspace-tab");
  window.print();
});

orderClientInput.value = state.order.client;
orderNumberInput.value = state.order.number;
includeDistributionInput.checked = state.order.includeDistribution;
quickModeInput.checked = state.order.quickMode;
exportScopeInput.value = state.order.exportScope;
searchQueryInput.value = state.filters.query;
filterTypeInput.value = state.filters.type;
exportSelectionSearchInput.value = state.filters.exportSelectionQuery;
updateSelects();
resetPackagingForm();
resetItemForm();
renderSummary();
saveState();
activateTab("workspace-tab");
