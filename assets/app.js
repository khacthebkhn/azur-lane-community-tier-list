(() => {
  "use strict";

  const payload = window.AZUR_LANE_DATA;
  if (!payload || !Array.isArray(payload.ships)) {
    document.getElementById("app").textContent = "Ship data could not be loaded.";
    return;
  }

  const ships = payload.ships;
  const gearCatalog = payload.gearCatalog || {};
  const shipById = new Map(ships.map(ship => [ship.id, ship]));
  const $ = selector => document.querySelector(selector);

  const tierView = $("#tier-view");
  const wikiView = $("#wiki-view");
  const detailView = $("#detail-view");
  const navLinks = Array.from(document.querySelectorAll("[data-nav]"));

  const ratingOrder = ["F", "D", "C", "B", "A", "S", "SS"];
  const tierOrder = ["Tier EX", "Tier 0", "Tier 1", "Tier 2", "Tier 3", "Tier 4", "Tier 5", "Tier N"];
  const ratingModes = ["Hard Arbiter", "META", "CM", "W14 Mob", "W14 Boss", "W15/16 Mob", "W15/16 Boss", "EX"];
  const campaignModes = ["W14 Mob", "W14 Boss", "W15/16 Mob", "W15/16 Boss"];
  const hullGroups = {
    BB: ["BB", "BC", "BBV", "BM", "IXm"],
    CV: ["CV", "CVL"],
    CA: ["CA", "CB"],
    CL: ["CL", "IXv"],
    DD: ["DD", "DDG"],
    SS: ["SS", "SSV", "IXs"]
  };
  const useCaseLabels = {
    C: "Campaign",
    "C-AA": "Campaign · high anti-air",
    "C-noAA": "Campaign · low anti-air",
    "C-12-": "Campaign · Chapter 12 or lower",
    "C-13+": "Campaign · Chapter 13 or higher",
    L: "Light-armor boss",
    M: "Medium-armor boss",
    H: "Heavy-armor boss",
    "L/M": "Light or medium boss",
    "M/H": "Medium or heavy boss",
    "L/M/H": "Any boss armor",
    Flag: "Flagship position",
    Top: "Top submarine position",
    Bottom: "Bottom submarine position",
    "Flag/Bottom": "Flagship or bottom position",
    "Top/Bottom": "Top or bottom position",
    "Flag/Top/Bottom": "Any fleet position"
  };

  function create(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase();
  }

  function slugify(value) {
    return normalizeText(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "ship";
  }

  function shipHref(ship) {
    return `#/wiki/${ship.id}-${slugify(ship.name)}`;
  }

  function avatarUrl(ship) {
    return `https://cdn.jsdelivr.net/gh/iujab/azurlane-images@main/thumbnails/${encodeURIComponent(ship.icon)}.png`;
  }

  function assignShipImage(image, ship, descriptive = false) {
    image.src = avatarUrl(ship);
    image.alt = descriptive ? `${ship.name} portrait` : "";
    image.loading = "lazy";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => { image.hidden = true; }, { once: true });
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date);
  }

  function normalizeRating(value) {
    return String(value || "").replace("*", "");
  }

  function ratingToTier(value) {
    const rating = normalizeRating(value);
    return {
      SS: "Tier EX",
      S: "Tier 0",
      A: "Tier 1",
      B: "Tier 2",
      C: "Tier 3",
      D: "Tier 4",
      F: "Tier 5"
    }[rating] || "Tier N";
  }

  function medianRating(ship, modes) {
    const values = modes
      .map(mode => ship.ratings[mode])
      .filter(Boolean)
      .map(raw => ({ raw, rank: ratingOrder.indexOf(normalizeRating(raw)) }))
      .filter(item => item.rank >= 0)
      .sort((a, b) => a.rank - b.rank);
    return values.length ? values[Math.floor((values.length - 1) / 2)].raw : "";
  }

  function getRating(ship, mode) {
    if (mode === "General PvE") return medianRating(ship, ratingModes);
    if (mode === "Campaign") return medianRating(ship, campaignModes);
    return ship.ratings[mode] || "";
  }

  function inHullGroup(ship, group) {
    if (group === "All") return true;
    const groupedHulls = Object.values(hullGroups).flat();
    if (group === "Other") return !groupedHulls.includes(ship.hull);
    return hullGroups[group].includes(ship.hull);
  }

  function setView(name) {
    tierView.hidden = name !== "tier-list";
    wikiView.hidden = name !== "wiki";
    detailView.hidden = name !== "detail";
    navLinks.forEach(link => {
      const active = link.dataset.nav === (name === "detail" ? "wiki" : name);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  const tierState = {
    mode: "General PvE",
    hull: "BB",
    selected: shipById.has(755) ? 755 : ships[0].id
  };

  const tierModeSelect = $("#tier-mode-select");
  const tierHullSelect = $("#tier-hull-select");
  const tierBoard = $("#tier-board");

  function renderTierSelected(ship) {
    const rawRating = getRating(ship, tierState.mode);
    const avatar = $("#tier-selected-avatar");
    avatar.hidden = false;
    assignShipImage(avatar, ship, true);
    $("#tier-selected-name").textContent = ship.name;
    $("#tier-selected-rank").textContent = ratingToTier(rawRating);
    $("#tier-selected-new").hidden = !ship.isNew;
    $("#tier-selected-meta").textContent = `${ship.hull} · ${ship.class} · ${ship.faction} · ${ship.rarity} · ${tierState.mode}: ${rawRating || "unrated"}`;
    const statKeys = ["HP", "FP", "TRP", "AA", "AVI", "RLD", "ACC", "EVA"];
    $("#tier-selected-stats").textContent = `Lv.125 · ${statKeys.filter(key => ship.stats[key] !== undefined).map(key => `${key} ${ship.stats[key]}`).join(" · ")}`;
    $("#tier-selected-description").textContent = ship.desc || "No community note is available for this ship.";
    $("#tier-selected-wiki").href = shipHref(ship);
  }

  function renderTierList() {
    const visible = ships.filter(ship => inHullGroup(ship, tierState.hull));
    if (!visible.some(ship => ship.id === tierState.selected) && visible.length) tierState.selected = visible[0].id;
    tierBoard.replaceChildren();

    tierOrder.forEach(tier => {
      const members = visible
        .filter(ship => ratingToTier(getRating(ship, tierState.mode)) === tier)
        .sort((a, b) => a.name.localeCompare(b.name));

      const row = create("section", "tier-row");
      row.setAttribute("aria-label", `${tier}, ${members.length} ships`);
      const label = create("div", "tier-label");
      label.append(create("strong", "", tier), create("span", "", `${members.length} ships`));
      const grid = create("div", "tier-ships");

      if (!members.length) {
        grid.append(create("p", "empty-tier", "No ships in this tier for the selected view."));
      }

      members.forEach(ship => {
        const button = create("button", `tier-ship${ship.isNew ? " is-new" : ""}`);
        button.type = "button";
        button.setAttribute("aria-pressed", String(ship.id === tierState.selected));
        button.setAttribute("aria-label", `${ship.name}, ${getRating(ship, tierState.mode) || "unrated"}, ${tier}`);
        const image = document.createElement("img");
        assignShipImage(image, ship);
        button.append(image, create("span", "", ship.name));
        button.addEventListener("click", () => {
          tierState.selected = ship.id;
          renderTierList();
        });
        grid.append(button);
      });

      row.append(label, grid);
      tierBoard.append(row);
    });

    if (visible.length) renderTierSelected(shipById.get(tierState.selected));
  }

  tierModeSelect.addEventListener("change", () => {
    tierState.mode = tierModeSelect.value;
    renderTierList();
  });

  tierHullSelect.addEventListener("change", () => {
    tierState.hull = tierHullSelect.value;
    renderTierList();
  });

  const wikiState = {
    query: "",
    className: "",
    faction: "",
    hull: "",
    rarity: "",
    page: 1,
    pageSize: 60
  };

  const wikiSearch = $("#wiki-search");
  const wikiClass = $("#wiki-class");
  const wikiFaction = $("#wiki-faction");
  const wikiHull = $("#wiki-hull");
  const wikiRarity = $("#wiki-rarity");
  const wikiGrid = $("#wiki-grid");
  const wikiPagination = $("#wiki-pagination");

  function appendOptions(select, values) {
    values.forEach(value => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.append(option);
    });
  }

  appendOptions(wikiClass, [...new Set(ships.map(ship => ship.class))].sort((a, b) => a.localeCompare(b)));
  appendOptions(wikiFaction, [...new Set(ships.map(ship => ship.faction))].sort((a, b) => a.localeCompare(b)));
  appendOptions(wikiHull, [...new Set(ships.map(ship => ship.hull))].sort((a, b) => a.localeCompare(b)));
  const rarityOrder = [
    "Common (C)",
    "Rare (R)",
    "Elite (E)",
    "Super Rare (SR)",
    "Ultra Rare (UR)"
  ];
  const availableRarities = new Set(ships.map(ship => ship.rarity));
  appendOptions(wikiRarity, rarityOrder.filter(rarity => availableRarities.has(rarity)));

  function filteredWikiShips() {
    const query = normalizeText(wikiState.query);
    return ships.filter(ship => {
      const searchable = normalizeText([ship.name, ...(ship.aliases || [])].join(" "));
      return (!query || searchable.includes(query))
        && (!wikiState.className || ship.class === wikiState.className)
        && (!wikiState.faction || ship.faction === wikiState.faction)
        && (!wikiState.hull || ship.hull === wikiState.hull)
        && (!wikiState.rarity || ship.rarity === wikiState.rarity);
    });
  }

  function directoryCard(ship) {
    const link = create("a", "directory-card");
    link.href = shipHref(ship);
    const image = document.createElement("img");
    assignShipImage(image, ship);
    const copy = create("span", "directory-copy");
    copy.append(
      create("strong", "", ship.name),
      create("span", "", `${ship.hull} · ${ship.rarity}`),
      create("span", "", ship.faction),
      create("span", "", ship.class)
    );
    link.append(image, copy);
    return link;
  }

  function pageButton(label, page, current = false, disabled = false) {
    const button = create("button", "button", label);
    button.type = "button";
    button.disabled = disabled;
    if (current) button.setAttribute("aria-current", "page");
    button.addEventListener("click", () => {
      wikiState.page = page;
      renderWiki();
      $("#wiki-title").scrollIntoView({ block: "start" });
    });
    return button;
  }

  function renderPagination(totalPages) {
    wikiPagination.replaceChildren();
    if (totalPages <= 1) return;
    wikiPagination.append(pageButton("Previous", Math.max(1, wikiState.page - 1), false, wikiState.page === 1));
    for (let page = 1; page <= totalPages; page += 1) {
      if (totalPages > 9 && page > 2 && page < totalPages - 1 && Math.abs(page - wikiState.page) > 2) {
        if (page === 3 || page === totalPages - 2) wikiPagination.append(create("span", "", "…"));
        continue;
      }
      wikiPagination.append(pageButton(String(page), page, page === wikiState.page));
    }
    wikiPagination.append(pageButton("Next", Math.min(totalPages, wikiState.page + 1), false, wikiState.page === totalPages));
  }

  function renderWiki() {
    const filtered = filteredWikiShips();
    const totalPages = Math.max(1, Math.ceil(filtered.length / wikiState.pageSize));
    wikiState.page = Math.min(wikiState.page, totalPages);
    const start = (wikiState.page - 1) * wikiState.pageSize;
    const pageShips = filtered.slice(start, start + wikiState.pageSize);
    wikiGrid.replaceChildren();
    if (pageShips.length) pageShips.forEach(ship => wikiGrid.append(directoryCard(ship)));
    else wikiGrid.append(create("p", "no-results", "No ships match the selected filters."));
    $("#wiki-results-count").textContent = `${filtered.length.toLocaleString()} ships${totalPages > 1 ? ` · page ${wikiState.page} of ${totalPages}` : ""}`;
    renderPagination(totalPages);
  }

  function updateWikiFilters() {
    wikiState.query = wikiSearch.value;
    wikiState.className = wikiClass.value;
    wikiState.faction = wikiFaction.value;
    wikiState.hull = wikiHull.value;
    wikiState.rarity = wikiRarity.value;
    wikiState.page = 1;
    renderWiki();
  }

  [wikiSearch, wikiClass, wikiFaction, wikiHull, wikiRarity].forEach(control => {
    control.addEventListener(control === wikiSearch ? "input" : "change", updateWikiFilters);
  });

  $("#wiki-clear").addEventListener("click", () => {
    wikiSearch.value = "";
    wikiClass.value = "";
    wikiFaction.value = "";
    wikiHull.value = "";
    wikiRarity.value = "";
    updateWikiFilters();
    wikiSearch.focus();
  });

  function gearSlotLabel(index, isAugment) {
    if (isAugment) return "Augment";
    if (index < 3) return `Slot ${index + 1}`;
    return `Auxiliary ${index - 2}`;
  }

  function gearItem(entry, index) {
    const [itemId, customNote, condition, value] = entry;
    const info = gearCatalog[String(itemId)] || [`Equipment ${itemId}`, null, 0];
    const [name, icon, augmentFlag] = info;
    const isAugment = augmentFlag === 1;
    const item = create("div", "gear-item");
    const visual = create("div", "gear-visual", isAugment ? "A" : "✦");
    if (!isAugment && icon) {
      const image = document.createElement("img");
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.referrerPolicy = "no-referrer";
      image.src = `https://cdn.jsdelivr.net/gh/Driveskull/AzurLaneSKINS@main/images/equipment/${icon}.png`;
      image.addEventListener("error", () => { image.remove(); }, { once: true });
      visual.append(image);
    }
    const copy = create("div", "gear-copy");
    copy.append(create("span", "", gearSlotLabel(index, isAugment)), create("strong", "", name));
    const notes = [customNote, condition, value === 2 ? "debatable priority" : ""].filter(Boolean);
    if (notes.length) copy.append(create("span", "gear-note", notes.join(" · ")));
    item.append(visual, copy);
    return item;
  }

  function renderDetail(ship) {
    const avatar = $("#detail-avatar");
    avatar.hidden = false;
    assignShipImage(avatar, ship, true);
    $("#detail-name").textContent = ship.name;
    $("#detail-faction").textContent = ship.faction;
    $("#detail-new").hidden = !ship.isNew;
    $("#detail-meta").textContent = `${ship.class} · ${ship.hull} · ${ship.rarity}${ship.isRetrofit ? " · Retrofit stats" : ""}`;
    $("#detail-description").textContent = ship.desc || "No community note is available for this ship.";

    const ratings = $("#detail-ratings");
    ratings.replaceChildren();
    ["General PvE", "Campaign", ...ratingModes].forEach(mode => {
      const raw = getRating(ship, mode);
      const card = create("div", "rating-card");
      card.append(create("span", "", mode), create("strong", "", raw || "Unrated"), create("span", "rating-value", ratingToTier(raw)));
      ratings.append(card);
    });

    const stats = $("#detail-stats");
    stats.replaceChildren();
    const statOrder = ["HP", "Armor", "FP", "TRP", "AA", "AVI", "RLD", "ACC", "EVA", "ASW", "SPD", "LCK", "Cost"];
    statOrder.filter(key => ship.stats[key] !== undefined).forEach(key => {
      const card = create("div", "stat-card");
      card.append(create("span", "", key), create("strong", "", String(ship.stats[key])));
      stats.append(card);
    });

    const skills = $("#detail-skills");
    skills.replaceChildren();
    if (!ship.skills.length) {
      skills.append(create("p", "no-results", "No skill data is available for this ship."));
    } else {
      ship.skills.forEach(skill => {
        const card = create("article", "skill-card");
        const header = document.createElement("header");
        header.append(create("h3", "", skill.name), create("span", "meta-chip", skill.max ? `Lv. ${skill.max}` : "Passive"));
        const copy = create("div", "skill-copy");
        const english = create("div", "skill-language");
        english.append(create("span", "language-label", "English"), create("p", "", skill.en || "Description unavailable."));
        const vietnamese = create("div", "skill-language");
        vietnamese.append(create("span", "language-label", "Tiếng Việt"), create("p", "", skill.vi || "Chưa có bản dịch tiếng Việt."));
        copy.append(english, vietnamese);
        card.append(header, copy);
        skills.append(card);
      });
    }

    const equipment = $("#detail-equipment");
    equipment.replaceChildren();
    const scenarios = Object.entries(ship.gearSets || {});
    if (!scenarios.length) {
      equipment.append(create("p", "no-results", "No community equipment recommendations are available for this ship."));
    } else {
      scenarios.forEach(([scenario, entries]) => {
        const card = create("article", "scenario-card");
        const header = document.createElement("header");
        header.append(create("h3", "", useCaseLabels[scenario] || scenario), create("span", "meta-chip", `${entries.length} items`));
        const loadout = create("div", "scenario-loadout");
        entries.forEach((entry, index) => loadout.append(gearItem(entry, index)));
        card.append(header, loadout);
        equipment.append(card);
      });
    }

    document.title = `${ship.name} · Azur Lane Community Guide`;
  }

  function route() {
    const path = location.hash.replace(/^#\/?/, "");
    const [section, detail] = path.split("/");
    if (section === "wiki" && detail) {
      const shipId = Number.parseInt(detail, 10);
      const ship = shipById.get(shipId);
      if (ship) {
        setView("detail");
        renderDetail(ship);
        window.scrollTo({ top: 0, behavior: "auto" });
        return;
      }
    }
    if (section === "wiki") {
      setView("wiki");
      renderWiki();
      document.title = "Ship Wiki · Azur Lane Community Guide";
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
    setView("tier-list");
    renderTierList();
    document.title = "Azur Lane Community Tier List";
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  const generatedLabel = `Data refreshed ${formatDate(payload.generatedAt)}`;
  $("#tier-data-date").textContent = generatedLabel;
  $("#wiki-data-date").textContent = `${generatedLabel} · ${ships.length.toLocaleString()} ships`;
  window.addEventListener("hashchange", route);
  if (!location.hash) location.hash = "#/tier-list";
  else route();
})();
