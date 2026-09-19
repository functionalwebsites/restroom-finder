import { normalize, queryFor, kmlFor, directionsFor } from "./data.js";
import { settings } from "./config.js";
const $ = (id) => document.getElementById(id);
let position = null,
  rows = [],
  busy = false;
let page = 0,
  view = "list",
  map = null,
  markers = null;
const pageSize = settings.resultLimit;
const visibleRows = () => rows.slice(page * pageSize, (page + 1) * pageSize);
$("radius").replaceChildren(
  ...settings.searchRadiiMeters.map(
    (radius) => new Option(`${radius / 1000} km`, String(radius)),
  ),
);
$("radius").value = String(settings.defaultRadiusMeters);
function message(text, error = false) {
  $("status").textContent = text;
  $("status").className = error ? "error" : "";
}
function lock(on) {
  busy = on;
  for (const id of ["locate", "radius", "example"])
    if ($(id)) $(id).disabled = on;
  updatePager();
  $("coordinates").querySelector("button").disabled = on;
}
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
function link(text, url, cls = "", newTab = true) {
  const a = el("a", cls, text);
  a.href = url;
  if (newTab) a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}
function render() {
  const root = $("results");
  root.replaceChildren();
  $("results-footer").hidden = !rows.length;
  $("reopen").hidden = !rows.length;
  const visible = visibleRows();
  updatePager();
  $("summary").textContent = visible.length
    ? `${page * pageSize + 1}–${page * pageSize + visible.length} of ${rows.length} · nearest first`
    : "No mapped options in this area.";
  if (!visible.length) {
    const box = el("div", "empty");
    box.append(
      el("h3", "", "No mapped restrooms found here."),
      el(
        "p",
        "",
        "Try a wider search radius. The map may be missing local restrooms.",
      ),
    );
    root.append(box);
    return;
  }
  const provider = $("maps-app").value;
  const appName = provider === "apple" ? "Apple Maps" : "Google Maps";
  visible.forEach((r, i) => {
    const card = el("article", "card");
    card.append(el("div", "rank", String(page * pageSize + i + 1)));
    const body = el("div", "card-body");
    body.append(
      el(
        "h3",
        "",
        r.name === "Unnamed restroom"
          ? `Restroom ${page * pageSize + i + 1} · ${r.direction.label.toLowerCase()}`
          : r.name,
      ),
    );
    const meters =
      r.meters < 1000
        ? Math.max(10, Math.round(r.meters / 10) * 10) + " m"
        : (r.meters / 1000).toFixed(1) + " km";
    const relative =
      $("location-title").textContent === "Your current location"
        ? "you"
        : "search location";
    body.append(
      el(
        "p",
        "bearing",
        `${r.direction.arrow} ${meters} · ${r.direction.uncertain ? "Too close for a reliable direction" : r.direction.label + " of " + relative}`,
      ),
    );

    const access =
      r.access === "unknown"
        ? "Public access not confirmed"
        : r.access === "permissive"
          ? "Permissive access"
          : "Mapped public access";
    body.append(
      el(
        "p",
        r.access === "unknown" ? "access-note uncertain" : "access-note",
        access + (r.fee === "yes" ? " · Fee required" : ""),
      ),
    );
    const actions = el("div", "directions");
    const route = link(`${appName} ↗`, directionsFor(r)[provider], "", false);
    route.setAttribute(
      "aria-label",
      `Open restroom ${page * pageSize + i + 1}, ${r.name}, in ${appName}`,
    );
    actions.append(route);
    body.append(actions);
    const details = el("details", "place-details");
    details.append(el("summary", "", "Hours & details"));
    details.append(
      el(
        "p",
        "meta",
        r.hours
          ? "Listed hours: " + r.hours
          : "Hours unknown. Availability is not verified.",
      ),
    );
    if (!r.standalone)
      details.append(
        el(
          "p",
          "meta",
          "Mapped at this facility; exact restroom entrance unknown.",
        ),
      );
    if (r.operator) details.append(el("p", "meta", "Operator: " + r.operator));
    if (r.wheelchair !== "unknown")
      details.append(el("p", "meta", "Wheelchair access: " + r.wheelchair));
    if (r.changing === "yes")
      details.append(el("p", "meta", "Changing table listed"));
    if (r.description) details.append(el("p", "meta", r.description));
    details.append(
      link(
        "View or improve source ↗",
        "https://www.openstreetmap.org/" + r.id,
        "source-link",
      ),
    );
    const more = el("button", "details-button", "Details");
    more.addEventListener("click", () => {
      $("place-title").textContent = r.name;
      $("place-content").replaceChildren(
        ...Array.from(details.children)
          .slice(1)
          .map((node) => node.cloneNode(true)),
      );
      $("place-dialog").showModal();
    });
    actions.append(more);
    card.append(body);
    root.append(card);
  });
  if (view === "map") renderMap();
}
$("maps-app").addEventListener("change", () => {
  if (rows.length) render();
});
async function search(p, label) {
  if (busy) return { error: "A search is already running." };
  if (
    !Number.isFinite(p.lat) ||
    !Number.isFinite(p.lon) ||
    Math.abs(p.lat) > 90 ||
    Math.abs(p.lon) > 180
  )
    throw new Error("Enter valid latitude and longitude.");
  openFinder();
  page = 0;
  lock(true);
  position = p;
  rows = [];
  if (markers) markers.clearLayers();
  updatePager();
  $("results").replaceChildren();
  $("results-footer").hidden = true;
  $("location-title").textContent = label;
  $("location-detail").textContent =
    `${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}${p.accuracy ? " · accuracy about " + Math.round(p.accuracy) + " m" : ""}`;
  $("summary").textContent = "Searching nearby mapped facilities…";
  message("Looking for restrooms, including park facilities…");
  const query = queryFor(p, Number($("radius").value));
  let data;
  try {
    for (const endpoint of settings.dataServices) {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        settings.requestTimeoutMs,
      );
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          body: new URLSearchParams({ data: query }),
          signal: controller.signal,
        });
        if (!response.ok) throw Error("Service unavailable");
        data = await response.json();
        if (data.remark || !Array.isArray(data.elements))
          throw Error("Incomplete response");
        break;
      } catch {
        data = null;
      } finally {
        clearTimeout(timer);
      }
      message("The first data service is busy. Trying another…");
    }
    if (!data)
      throw Error(
        "The restroom data service couldn’t be reached. Please try again in a moment.",
      );
    rows = normalize(data.elements, p, Number($("radius").value));
    render();
    message(
      p.accuracy > 200
        ? "Your location is approximate. Nearby results may be less precise."
        : "",
    );
    return { count: rows.length, results: rows };
  } catch (error) {
    $("summary").textContent = "Search couldn’t be completed.";
    message(error.message, true);
    return { error: error.message };
  } finally {
    lock(false);
  }
}
$("locate").addEventListener("click", () => {
  openFinder();
  if (!navigator.geolocation) {
    message(
      "This browser does not support location. Enter coordinates below.",
      true,
    );
    return;
  }
  lock(true);
  message("Waiting for your location. Allow access when your browser asks.");
  navigator.geolocation.getCurrentPosition(
    (p) => {
      lock(false);
      search(
        {
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          accuracy: p.coords.accuracy,
        },
        "Your current location",
      );
    },
    (error) => {
      lock(false);
      message(
        error.code === 1
          ? "Location access was denied. Enable it in your browser’s site settings, or enter coordinates below."
          : error.code === 3
            ? "Finding your location timed out. Try again, or enter coordinates below."
            : "Your location couldn’t be determined. Try again, or enter coordinates below.",
        true,
      );
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
  );
});
$("example").addEventListener("click", () =>
  search({ lat: 37.7694, lon: -122.4862 }, "Example · Golden Gate Park"),
);
$("radius").addEventListener("change", () => {
  if (position) search(position, $("location-title").textContent);
});
$("coordinates").addEventListener("submit", (e) => {
  e.preventDefault();
  search(
    { lat: Number($("lat").value), lon: Number($("lon").value) },
    "Entered location",
  );
});
$("export").addEventListener("click", () => {
  if (!rows.length) return;
  const url = URL.createObjectURL(
    new Blob([kmlFor(rows)], { type: "application/vnd.google-earth.kml+xml" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "nearby-restrooms.kml";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
});
if (document.modelContext?.registerTool) {
  try {
    Promise.resolve(
      document.modelContext.registerTool({
        name: "find_nearby_restrooms",
        title: "Find nearby restrooms",
        description:
          "Search mapped restrooms near supplied coordinates and display results. Coordinates are sent to public Overpass services.",
        inputSchema: {
          type: "object",
          properties: {
            latitude: { type: "number", minimum: -90, maximum: 90 },
            longitude: { type: "number", minimum: -180, maximum: 180 },
          },
          required: ["latitude", "longitude"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) => {
          if (
            !input ||
            typeof input.latitude !== "number" ||
            typeof input.longitude !== "number"
          )
            throw Error("Numeric latitude and longitude are required.");
          return search(
            { lat: input.latitude, lon: input.longitude },
            "Entered location",
          );
        },
      }),
    ).catch(() => {});
  } catch {}
}

function openFinder() {
  if (!$("finder").open) $("finder").showModal();
  document.body.classList.add("finder-open");
  if (view === "map" && rows.length) requestAnimationFrame(renderMap);
}
$("close-finder").addEventListener("click", () => $("finder").close());
$("finder").addEventListener("close", () => {
  document.body.classList.remove("finder-open");
  $("reopen").hidden = !rows.length;
});
$("reopen").addEventListener("click", openFinder);
$("close-place").addEventListener("click", () => $("place-dialog").close());
function updatePager() {
  $("next").textContent = `Next ${pageSize} →`;
  $("previous").disabled = busy || page === 0;
  $("next").disabled = busy || (page + 1) * pageSize >= rows.length;
  $("page-label").textContent = rows.length
    ? `${page + 1} / ${Math.ceil(rows.length / pageSize)}`
    : "0 places";
}
$("next").addEventListener("click", () => {
  if ((page + 1) * pageSize < rows.length) {
    page++;
    render();
  }
});
$("previous").addEventListener("click", () => {
  if (page > 0) {
    page--;
    render();
  }
});
function setView(nextView) {
  view = nextView;
  $("results").hidden = view !== "list";
  $("map-panel").hidden = view !== "map";
  $("list-view").setAttribute("aria-pressed", String(view === "list"));
  $("map-view").setAttribute("aria-pressed", String(view === "map"));
  if (view === "map") requestAnimationFrame(renderMap);
}
$("list-view").addEventListener("click", () => setView("list"));
$("map-view").addEventListener("click", () => setView("map"));
function renderMap() {
  if (!position || !rows.length) return;
  if (!window.L) {
    $("map-error").hidden = false;
    return;
  }
  if (!map) {
    map = L.map("map");
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    })
      .on("tileerror", () => {
        $("map-error").hidden = false;
      })
      .addTo(map);
    markers = L.layerGroup().addTo(map);
  }
  map.invalidateSize();
  markers.clearLayers();
  const origin = [position.lat, position.lon];
  L.circleMarker(origin, {
    radius: 8,
    color: "#fff",
    weight: 3,
    fillColor: "#2071d5",
    fillOpacity: 1,
  })
    .addTo(markers)
    .bindTooltip("Search location");
  const bounds = [origin];
  visibleRows().forEach((r, i) => {
    const number = page * pageSize + i + 1;
    const point = [r.lat, r.lon];
    bounds.push(point);
    const popup = el("div", "map-popup");
    popup.append(
      el("strong", "", r.name),
      el("p", "", `${Math.round(r.meters)} m · ${r.direction.label}`),
      link(
        "Walking directions ↗",
        directionsFor(r)[$("maps-app").value],
        "",
        false,
      ),
    );
    L.marker(point, {
      icon: L.divIcon({
        className: "restroom-pin",
        html: String(number),
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      }),
      title: `${number}. ${r.name}`,
      alt: `${number}. ${r.name}`,
    })
      .addTo(markers)
      .bindPopup(popup);
  });
  map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
}
