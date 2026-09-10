export function createExplorationMapAttractionsHandler({
  connectToDatabase: connect,
  getExplorationMapAttractions: getMapAttractions,
}) {
  return async function getExplorationMapAttractionsHandler() {
    try {
      await connect();
      const data = await getMapAttractions();

      return Response.json({
        success: true,
        count: data.length,
        data,
      });
    } catch {
      return Response.json(
        {
          success: false,
          message: "Failed to retrieve map attractions.",
        },
        { status: 500 }
      );
    }
  };
}
