import duckdb as db
import time

def xml_to_db(XML_PATH):
    con.sql(f"""
    INSERT INTO {TABLE}
    WITH docs AS (
      SELECT xml FROM read_xml_objects('{XML_PATH}', maximum_file_size = 100000000)
    ),
    muns_xml AS (
      SELECT unnest(xml_extract_elements(xml, '//Objecten:Woonplaats')) AS mun_xml
      FROM docs
    ),
    extracted AS (
      SELECT
        xml_extract_text(mun_xml, '//Objecten:identificatie')[1] AS identificatie,
        xml_extract_text(mun_xml, '//Objecten:naam')[1] AS naam,
        xml_extract_text(mun_xml, '//Objecten:status')[1] AS status,
        TRY_CAST(xml_extract_text(mun_xml, '//Objecten:documentdatum')[1] AS DATE) AS documentdatum,
        TRY_CAST(xml_extract_text(mun_xml, '//gml:Polygon/gml:exterior/gml:LinearRing/gml:posList')[1] AS VARCHAR) AS poslist
      FROM muns_xml
      WHERE xml_extract_text(mun_xml, '//Historie:eindGeldigheid')[1] IS NULL
    )
    SELECT
      identificatie,
      naam,
      status,
      documentdatum,
      ST_GeomFromText(
          'POLYGON((' ||
          array_to_string(
            list_transform(
              range(1, len(nums), 2),
              i -> list_extract(nums, i) || ' ' || list_extract(nums, i + 1)
            ),
            ', '
          ) ||
          '))'
        ) AS geom
    FROM (
      SELECT
        identificatie,
        naam,
        status,
        documentdatum,
        list_filter(str_split(poslist, ' '), x -> x <> '') AS nums
      FROM extracted
    ) t
    """)

if __name__ == "__main__":
    con = db.connect('mun.db')
    con.install_extension("spatial")
    con.load_extension("spatial")
    con.execute("INSTALL webbed FROM community")
    con.load_extension("webbed")

    XML_PATH = 'mun\*.xml'
    TABLE = "municipalities"

    tic = time.time()

    con.sql(f"DROP TABLE IF EXISTS {TABLE};")
    con.sql(f"""
    CREATE TABLE {TABLE} (
      identificatie TEXT,
      naam TEXT,
      status TEXT,
      documentdatum DATE,
      geom GEOMETRY
    );
    """)

    XML_PATH = 'mun\9999WPL08122025-000001.xml'
    xml_to_db(XML_PATH)

    tac = time.time()

    print(con.sql(f"SELECT * FROM {TABLE} LIMIT 5;").show())

    print("time:", (tac - tic), "s")

    con.close()