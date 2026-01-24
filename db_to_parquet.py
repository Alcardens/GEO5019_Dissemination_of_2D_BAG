import duckdb as db
import time

con = db.connect("postcode.db")

con.install_extension('spatial')
con.load_extension('spatial')

# con.sql('''COPY
#     (SELECT postcode, geom FROM ST_READ('cbs_pc4_2024_v1.gpkg') ORDER BY
#     ST_Hilbert(geom, ST_Extent(ST_MakeEnvelope(0, 280000, 310000, 640000))))
#     TO 'postcode.parquet' (FORMAT 'parquet', COMPRESSION 'zstd');''')
#
# minx = 250000
# miny = 590000
# maxx = 260000
# maxy = 600000

tic = time.time()
# total_count_b_in_bbox = con.execute(f"""
#         SELECT COUNT(*)
#         FROM 'bag.parquet' AS pnd,
#         (SELECT * FROM 'mun.parquet' WHERE naam = 'Delft') AS wpl
#         WHERE ST_Intersects(pnd.geom, wpl.geom);
#         """).fetchone()
# total_count = total_count_b_in_bbox[0]
# print(total_count)
# print("time:", (tac - tic) * 1000, "ms")

# con.sql(f"""
#             SELECT pnd.identificatie, pnd.status, pnd.oorspronkelijkBouwjaar, pnd.documentdatum, ST_AsGeoJSON(pnd.geom) AS geom
#             FROM "bag.parquet" as pnd, (SELECT * FROM 'mun.parquet' WHERE naam = 'Delft' OR identificatie = 'Delft') as wpl
#             WHERE ST_Intersects(pnd.geom, wpl.geom)
#             LIMIT 1000;
#         """).show()

con.sql(
    """
COPY (
    SELECT *
    FROM 'mun.parquet'
)
TO 'bag.pmtiles'
WITH (
    FORMAT GDAL,
    DRIVER 'PMTiles',
    LAYER_CREATION_OPTIONS ('MINZOOM=0', 'MAXZOOM=14')
)
"""
)

tac = time.time()
print("time:", (tac - tic) * 1000, "ms")

con.close()