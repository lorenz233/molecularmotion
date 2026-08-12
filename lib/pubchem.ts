const PUBCHEM = "https://pubchem.ncbi.nlm.nih.gov/rest/pug";
const elementSymbols = [
  "", "H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne", "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar", "K", "Ca",
  "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn", "Ga", "Ge", "As", "Se", "Br", "Kr", "Rb", "Sr", "Y", "Zr",
  "Nb", "Mo", "Tc", "Ru", "Rh", "Pd", "Ag", "Cd", "In", "Sn", "Sb", "Te", "I", "Xe", "Cs", "Ba", "La", "Ce", "Pr", "Nd",
  "Pm", "Sm", "Eu", "Gd", "Tb", "Dy", "Ho", "Er", "Tm", "Yb", "Lu", "Hf", "Ta", "W", "Re", "Os", "Ir", "Pt", "Au", "Hg",
  "Tl", "Pb", "Bi", "Po", "At", "Rn", "Fr", "Ra", "Ac", "Th", "Pa", "U", "Np", "Pu", "Am", "Cm", "Bk", "Cf", "Es", "Fm",
  "Md", "No", "Lr", "Rf", "Db", "Sg", "Bh", "Hs", "Mt", "Ds", "Rg", "Cn", "Nh", "Fl", "Mc", "Lv", "Ts", "Og",
];
const subscriptDigits: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉" };

type PubChemCompound = {
  id?: { id?: { cid?: number } };
  atoms?: { aid?: number[]; element?: number[] };
  bonds?: { aid1?: number[]; aid2?: number[]; order?: number[] };
  coords?: Array<{ aid?: number[]; conformers?: Array<{ x?: number[]; y?: number[]; z?: number[] }> }>;
  props?: Array<{ urn?: { label?: string; name?: string }; value?: { sval?: string; fval?: number; ival?: number } }>;
};
type PubChemProperties = { Title?: string; MolecularFormula?: string; MolecularWeight?: string; IUPACName?: string };

export class MoleculeLookupError extends Error {
  status: number;
  constructor(message: string, status = 500) { super(message); this.status = status; }
}

function isSmiles(query: string) {
  const isCas = /^\d{2,7}-\d{2}-\d$/.test(query);
  return !isCas && !/\s/.test(query) && (
    /[=#()[\]@+\\/.]/.test(query) || /\d/.test(query) ||
    /^(?:(?:Br|Cl|Si|Na|Li|Mg|Ca)|[BCNOFPSIbcnops]){2,}/.test(query)
  );
}

function prop(compound: PubChemCompound, label: string) {
  const value = compound.props?.find((item) => item.urn?.label === label)?.value;
  return value?.sval ?? (value?.fval != null ? String(value.fval) : value?.ival != null ? String(value.ival) : undefined);
}

function formulaFromElements(elements: string[]) {
  const counts = new Map<string, number>();
  elements.forEach((element) => counts.set(element, (counts.get(element) ?? 0) + 1));
  const ordered = [...counts.keys()].sort((a, b) => {
    const rank = (element: string) => element === "C" ? 0 : element === "H" ? 1 : 2;
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  return ordered.map((element) => `${element}${(counts.get(element) ?? 1) > 1 ? counts.get(element) : ""}`).join("");
}

function displayName(query: string, kind: "smiles" | "cas" | "name", properties?: PubChemProperties) {
  if (kind === "smiles" && (properties?.IUPACName || properties?.Title)) return properties.IUPACName ?? properties.Title ?? "Custom structure";
  if (kind === "cas" && (properties?.Title || properties?.IUPACName)) return properties.Title ?? properties.IUPACName ?? query;
  return query.replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toUpperCase());
}

async function fetchRecord(query: string, kind: "smiles" | "cas" | "name") {
  if (kind === "smiles") {
    return fetch(`${PUBCHEM}/compound/smiles/record/JSON?record_type=3d`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ smiles: query }),
    });
  }
  return fetch(`${PUBCHEM}/compound/name/${encodeURIComponent(query)}/record/JSON?record_type=3d`);
}

export async function lookupMolecule(rawQuery: string) {
  const query = rawQuery.trim();
  if (query.length < 2 || query.length > 500) throw new MoleculeLookupError("Enter a molecule name, CAS number, or SMILES string.", 400);
  const kind = isSmiles(query) ? "smiles" : /^\d{2,7}-\d{2}-\d$/.test(query) ? "cas" : "name";
  const response = await fetchRecord(query, kind);
  if (!response.ok) throw new MoleculeLookupError(response.status === 404 ? "No matching 3D structure was found." : "The molecular archive could not complete this search.", response.status === 404 ? 404 : 502);

  const payload = await response.json() as { PC_Compounds?: PubChemCompound[] };
  const compound = payload.PC_Compounds?.[0];
  const atomIds = compound?.atoms?.aid ?? [];
  const atomicNumbers = compound?.atoms?.element ?? [];
  const coordinateSet = compound?.coords?.find((item) => item.conformers?.[0]?.x?.length);
  const conformer = coordinateSet?.conformers?.[0];
  if (!compound || !atomIds.length || !conformer?.x || !conformer.y) throw new MoleculeLookupError("A record was found, but it has no usable 3D conformer.", 422);
  if (atomIds.length > 240) throw new MoleculeLookupError("This structure is too large for the interactive viewer (240 atom limit).", 413);

  const coordinateIds = coordinateSet?.aid ?? atomIds;
  const coordinates = new Map<number, [number, number, number]>();
  coordinateIds.forEach((atomId, index) => coordinates.set(atomId, [conformer.x?.[index] ?? 0, conformer.y?.[index] ?? 0, conformer.z?.[index] ?? 0]));
  const idToIndex = new Map(atomIds.map((atomId, index) => [atomId, index]));
  const elements = atomicNumbers.map((atomicNumber) => elementSymbols[atomicNumber] ?? "X");
  const atoms = atomIds.map((atomId, index) => ({ element: elements[index], position: coordinates.get(atomId) ?? [0, 0, 0] as [number, number, number] }));
  const aid1 = compound.bonds?.aid1 ?? [];
  const aid2 = compound.bonds?.aid2 ?? [];
  const orders = compound.bonds?.order ?? [];
  const bonds = aid1.flatMap((firstId, index) => {
    const first = idToIndex.get(firstId);
    const second = idToIndex.get(aid2[index]);
    return first == null || second == null ? [] : [[first, second, Math.min(3, Math.max(1, orders[index] ?? 1))] as [number, number, number]];
  });
  const cid = compound.id?.id?.cid;
  let properties: PubChemProperties | undefined;
  if (cid) {
    const propertyResponse = await fetch(`${PUBCHEM}/compound/cid/${cid}/property/Title,MolecularFormula,MolecularWeight,IUPACName/JSON`);
    if (propertyResponse.ok) {
      const propertyPayload = await propertyResponse.json() as { PropertyTable?: { Properties?: PubChemProperties[] } };
      properties = propertyPayload.PropertyTable?.Properties?.[0];
    }
  }
  const formula = properties?.MolecularFormula ?? prop(compound, "Molecular Formula") ?? formulaFromElements(elements);
  const mass = properties?.MolecularWeight ?? prop(compound, "Molecular Weight");

  return {
    id: `pubchem-${cid ?? "structure"}-${encodeURIComponent(query).slice(0, 24)}`,
    name: displayName(query, kind, properties),
    subtitle: kind === "smiles" ? "Generated from SMILES" : kind === "cas" ? `CAS ${query}` : "Loaded from the molecular archive",
    formula: formula.replace(/\d/g, (digit) => subscriptDigits[digit]),
    mass: mass ? `${mass} g·mol⁻¹` : "Not reported",
    geometry: "Computed 3D conformer",
    note: `Loaded from PubChem${cid ? ` · CID ${cid}` : ""}. This is a computed conformer, not a crystallographic structure.`,
    accent: "#f4f4f2",
    atoms,
    bonds,
  };
}
