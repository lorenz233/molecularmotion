import { lookupMolecule, MoleculeLookupError } from "../../../lib/pubchem";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { query?: unknown };
    const molecule = await lookupMolecule(typeof body.query === "string" ? body.query : "");
    return Response.json({ molecule });
  } catch (error) {
    const status = error instanceof MoleculeLookupError ? error.status : 500;
    const message = error instanceof MoleculeLookupError ? error.message : "Something went wrong while reading that structure.";
    return Response.json({ error: message }, { status });
  }
}
