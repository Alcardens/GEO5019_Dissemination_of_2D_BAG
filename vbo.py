import duckdb as db
import time

def xml_to_db(XML_PATH):
    con.sql(f"""
    INSERT INTO {TABLE}
    WITH docs AS (
      SELECT xml FROM read_xml_objects('{XML_PATH}', maximum_file_size = 32000000)
    ),
    vbos_xml AS (
      SELECT unnest(xml_extract_elements(xml, '//Objecten:Verblijfsobject')) AS vbo_xml
      FROM docs
    ),
    extracted AS (
      SELECT
        xml_extract_text(vbo_xml, '//Objecten:identificatie')[1] AS identificatie,
        xml_extract_text(vbo_xml, '//Objecten:status')[1] AS status,
        xml_extract_text(vbo_xml, '//Objecten:gebruiksdoel')[1] AS gebruiksdoel,
        TRY_CAST(xml_extract_text(vbo_xml, '//Objecten:oppervlakte')[1] AS INTEGER) AS oppervlakte,
        TRY_CAST(xml_extract_text(vbo_xml, '//Objecten:documentdatum')[1] AS DATE) AS documentdatum,
        xml_extract_text(vbo_xml, '//Objecten-ref:PandRef')[1] AS pand,
        xml_extract_text(vbo_xml, '//Objecten:heeftAlsHoofdadres/Objecten-ref:NummeraanduidingRef')[1] AS hoofdadres,
        xml_extract_text(vbo_xml, '//gml:pos')[1] AS pos
      FROM vbos_xml
      WHERE xml_extract_text(vbo_xml, '//Historie:eindGeldigheid')[1] IS NULL
    )
    SELECT
      identificatie,
      status,
      gebruiksdoel,
      documentdatum,
      oppervlakte,
      pand,
      hoofdadres,
      ST_GeomFromText(
        'POINT(' ||
            list_extract(nums, 1) || ' ' || list_extract(nums, 2) ||
        ')'
      ) AS geom
    FROM (
      SELECT
        identificatie,
        status,
        gebruiksdoel,
        documentdatum,
        oppervlakte,
        pand,
        hoofdadres,
        list_filter(str_split(pos, ' '), x -> x <> '') AS nums
      FROM extracted
    ) t
    """)

if __name__ == "__main__":
    con = db.connect('vbo.db')
    con.install_extension("spatial")
    con.load_extension("spatial")
    con.execute("INSTALL webbed FROM community")
    con.load_extension("webbed")

    TABLE = "verblijfsobjecten"

    tic = time.time()

    con.sql(f"DROP TABLE IF EXISTS {TABLE};")
    con.sql(f"""
    CREATE TABLE {TABLE} (
      identificatie TEXT,
      status TEXT,
      gebruiksdoel TEXT,
      documentdatum DATE,
      oppervlakte INTEGER,
      pand TEXT,
      hoofdadres TEXT,
      geom GEOMETRY
    );
    """)

    for i in range(1,2534):
        XML_PATH = f'vbo\9999VBO08122025-{i:06d}.xml'
        if i%100 == 0:
            print(i)
            print("time:", (time.time() - tic), "s")
        xml_to_db(XML_PATH)

    tac = time.time()

    print(con.sql(f"SELECT * FROM {TABLE} LIMIT 5;").show())

    print("time:", (tac - tic), "s")

    con.close()