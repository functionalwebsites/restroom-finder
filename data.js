export function distance(a, b) {
  const rad = Math.PI / 180;
  const x =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) *
      Math.cos(b.lat * rad) *
      Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}
export function compassDirection(origin, destination) {
  // Initial bearing relative to true north, not the direction the phone faces.
  if (distance(origin, destination) < Math.max(20, origin.accuracy || 0)) {
    return { label: "Very close", arrow: "◎", uncertain: true };
  }
  const rad = Math.PI / 180;
  const delta = (destination.lon - origin.lon) * rad;
  const y = Math.sin(delta) * Math.cos(destination.lat * rad);
  const x =
    Math.cos(origin.lat * rad) * Math.sin(destination.lat * rad) -
    Math.sin(origin.lat * rad) *
      Math.cos(destination.lat * rad) *
      Math.cos(delta);
  const bearing = (Math.atan2(y, x) / rad + 360) % 360;
  const labels = [
    "North",
    "Northeast",
    "East",
    "Southeast",
    "South",
    "Southwest",
    "West",
    "Northwest",
  ];
  const arrows = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
  const index = Math.round(bearing / 45) % 8;
  return { label: labels[index], arrow: arrows[index], uncertain: false };
}

function restroomName(tags, point, landmarks) {
  const name = tags["name:en"] || tags.name;
  if (
    name &&
    !/^(public )?(toilets?|restrooms?|bathrooms?|wc)$/i.test(name.trim())
  )
    return name;
  const street = tags["addr:street"];
  if (street)
    return `${[tags["addr:housenumber"], street].filter(Boolean).join(" ")} restroom`;
  const nearby = landmarks
    .map((e) => ({
      name: e.tags["name:en"] || e.tags.name,
      meters: distance(point, e.center || e),
    }))
    .filter((e) => e.meters <= 250)
    .sort((a, b) => a.meters - b.meters)[0];
  // A nearby mapped point is context, not proof the restroom belongs to the place.
  return nearby ? `Restroom near ${nearby.name}` : "Unnamed restroom";
}

export function normalize(elements, origin, radius) {
  const landmarks = elements.filter(
    (e) =>
      e.tags?.name &&
      e.tags.amenity !== "toilets" &&
      ["park", "playground", "garden"].includes(e.tags.leisure) &&
      Number.isFinite((e.center || e).lat) &&
      Number.isFinite((e.center || e).lon),
  );
  return elements
    .flatMap((e) => {
      const t = e.tags || {},
        p = e.center || e;
      const standalone = t.amenity === "toilets";
      if (!standalone && t.toilets !== "yes") return [];
      const access = t["toilets:access"] || t.access || "";
      if (
        !Number.isFinite(p.lat) ||
        !Number.isFinite(p.lon) ||
        (access && !["yes", "public", "permissive"].includes(access)) ||
        t["disused:amenity"] === "toilets" ||
        t.disused === "yes" ||
        t["toilets:access:conditional"] ||
        t["access:conditional"]
      )
        return [];
      if (!standalone && !["yes", "public", "permissive"].includes(access))
        return [];
      const meters = distance(origin, p);
      if (meters > radius) return [];
      return [
        {
          id: e.type + "/" + e.id,
          lat: p.lat,
          lon: p.lon,
          meters,
          name: restroomName(t, p, landmarks),
          direction: compassDirection(origin, p),
          access: access || "unknown",
          fee: t["toilets:fee"] || (standalone ? t.fee : "") || "unknown",
          wheelchair:
            t["toilets:wheelchair"] ||
            (standalone ? t.wheelchair : "") ||
            "unknown",
          hours:
            t["toilets:opening_hours"] ||
            (standalone ? t.opening_hours : "") ||
            "",
          changing: t.changing_table || t["toilets:changing_table"],
          operator: t.operator || "",
          description: t["toilets:description"] || t.description || "",
          standalone,
        },
      ];
    })
    .sort((a, b) => a.meters - b.meters);
}
export function queryFor(p, radius) {
  return `[out:json][timeout:25];(nwr(around:${radius},${p.lat},${p.lon})["amenity"="toilets"];nwr(around:${radius},${p.lat},${p.lon})["toilets"="yes"];nwr(around:${radius + 250},${p.lat},${p.lon})["leisure"~"^(park|playground|garden)$"]["name"];);out center tags;`;
}
export function xml(s) {
  return String(s).replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
}
export function kmlFor(rows) {
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Nearby restrooms</name><description>Data © OpenStreetMap contributors, ODbL. https://www.openstreetmap.org/copyright. Access and hours are not verified.</description>${rows.map((r) => `<Placemark><name>${xml(r.name)}</name><description>${xml("Access: " + r.access + "; Hours: " + (r.hours || "unknown") + "; Data © OpenStreetMap contributors (ODbL); https://www.openstreetmap.org/" + r.id)}</description><Point><coordinates>${r.lon},${r.lat},0</coordinates></Point></Placemark>`).join("")}</Document></kml>`;
}

// Universal HTTPS links open the installed app where supported, with a web fallback.
// Omit the origin so the navigation app uses the person's current location.
export function directionsFor(place) {
  if (
    !Number.isFinite(place.lat) ||
    !Number.isFinite(place.lon) ||
    Math.abs(place.lat) > 90 ||
    Math.abs(place.lon) > 180
  ) {
    throw new Error("Invalid destination coordinates.");
  }
  const destination = `${place.lat},${place.lon}`;
  return {
    apple: `https://maps.apple.com/?daddr=${destination}&dirflg=w`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=walking&dir_action=navigate`,
  };
}
