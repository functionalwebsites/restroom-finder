export function distance(a, b) {
  const rad = Math.PI / 180;
  const x =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) *
      Math.cos(b.lat * rad) *
      Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}
export function normalize(elements, origin, radius) {
  return elements
    .flatMap((e) => {
      const t = e.tags || {},
        p = e.center || e;
      const standalone = t.amenity === "toilets";
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
          name:
            t.name ||
            (standalone
              ? "Public restroom"
              : t.leisure === "park"
                ? "Park with restrooms"
                : "Facility with restrooms"),
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
  return `[out:json][timeout:25];(nwr(around:${radius},${p.lat},${p.lon})["amenity"="toilets"];nwr(around:${radius},${p.lat},${p.lon})["toilets"="yes"];);out center tags;`;
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
