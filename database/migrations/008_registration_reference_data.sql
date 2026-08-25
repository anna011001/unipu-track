WITH units(short_name, name) AS (
    VALUES
        ('FET', 'Fakultet ekonomije i turizma "Dr. Mijo Mirković" u Puli'),
        ('FIPU', 'Fakultet informatike u Puli'),
        ('FPZ', 'Fakultet prirodnih znanosti u Puli'),
        ('FOOZ', 'Fakultet za odgojne i obrazovne znanosti u Puli'),
        ('FFPU', 'Filozofski fakultet u Puli'),
        ('MFPU', 'Medicinski fakultet u Puli'),
        ('MAPU', 'Muzička akademija u Puli'),
        ('TFPU', 'Tehnički fakultet u Puli'),
        ('DAK', 'Studij Dizajn i audiovizualne komunikacije')
)
UPDATE unipu_track.organizational_units organizational_unit
SET name = units.name,
    updated_at = NOW()
FROM units
WHERE organizational_unit.short_name = units.short_name;

WITH units(short_name, name) AS (
    VALUES
        ('FET', 'Fakultet ekonomije i turizma "Dr. Mijo Mirković" u Puli'),
        ('FIPU', 'Fakultet informatike u Puli'),
        ('FPZ', 'Fakultet prirodnih znanosti u Puli'),
        ('FOOZ', 'Fakultet za odgojne i obrazovne znanosti u Puli'),
        ('FFPU', 'Filozofski fakultet u Puli'),
        ('MFPU', 'Medicinski fakultet u Puli'),
        ('MAPU', 'Muzička akademija u Puli'),
        ('TFPU', 'Tehnički fakultet u Puli'),
        ('DAK', 'Studij Dizajn i audiovizualne komunikacije')
)
INSERT INTO unipu_track.organizational_units (short_name, name)
SELECT units.short_name, units.name
FROM units
WHERE NOT EXISTS (
    SELECT 1
    FROM unipu_track.organizational_units existing
    WHERE existing.short_name = units.short_name
);

INSERT INTO unipu_track.countries (iso2_code, name_hr, name_en, region)
VALUES
    ('AT', 'Austrija', 'Austria', 'EU'),
    ('BE', 'Belgija', 'Belgium', 'EU'),
    ('BG', 'Bugarska', 'Bulgaria', 'EU'),
    ('CY', 'Cipar', 'Cyprus', 'EU'),
    ('CZ', 'Češka', 'Czechia', 'EU'),
    ('DK', 'Danska', 'Denmark', 'EU'),
    ('EE', 'Estonija', 'Estonia', 'EU'),
    ('FI', 'Finska', 'Finland', 'EU'),
    ('FR', 'Francuska', 'France', 'EU'),
    ('GR', 'Grčka', 'Greece', 'EU'),
    ('HR', 'Republika Hrvatska', 'Republic of Croatia', 'EU'),
    ('IE', 'Irska', 'Ireland', 'EU'),
    ('IT', 'Italija', 'Italy', 'EU'),
    ('LV', 'Latvija', 'Latvia', 'EU'),
    ('LT', 'Litva', 'Lithuania', 'EU'),
    ('LU', 'Luksemburg', 'Luxembourg', 'EU'),
    ('HU', 'Mađarska', 'Hungary', 'EU'),
    ('MT', 'Malta', 'Malta', 'EU'),
    ('NL', 'Nizozemska', 'Netherlands', 'EU'),
    ('DE', 'Njemačka', 'Germany', 'EU'),
    ('PL', 'Poljska', 'Poland', 'EU'),
    ('PT', 'Portugal', 'Portugal', 'EU'),
    ('RO', 'Rumunjska', 'Romania', 'EU'),
    ('SK', 'Slovačka', 'Slovakia', 'EU'),
    ('SI', 'Slovenija', 'Slovenia', 'EU'),
    ('ES', 'Španjolska', 'Spain', 'EU'),
    ('SE', 'Švedska', 'Sweden', 'EU'),
    ('AL', 'Albanija', 'Albania', 'OTHER_EUROPE'),
    ('AD', 'Andora', 'Andorra', 'OTHER_EUROPE'),
    ('AM', 'Armenija', 'Armenia', 'OTHER_EUROPE'),
    ('AZ', 'Azerbajdžan', 'Azerbaijan', 'OTHER_EUROPE'),
    ('BA', 'Bosna i Hercegovina', 'Bosnia and Herzegovina', 'OTHER_EUROPE'),
    ('BY', 'Bjelarus', 'Belarus', 'OTHER_EUROPE'),
    ('ME', 'Crna Gora', 'Montenegro', 'OTHER_EUROPE'),
    ('GE', 'Gruzija', 'Georgia', 'OTHER_EUROPE'),
    ('IS', 'Island', 'Iceland', 'OTHER_EUROPE'),
    ('XK', 'Kosovo', 'Kosovo', 'OTHER_EUROPE'),
    ('LI', 'Lihtenštajn', 'Liechtenstein', 'OTHER_EUROPE'),
    ('MD', 'Moldova', 'Moldova', 'OTHER_EUROPE'),
    ('MC', 'Monako', 'Monaco', 'OTHER_EUROPE'),
    ('MK', 'Sjeverna Makedonija', 'North Macedonia', 'OTHER_EUROPE'),
    ('NO', 'Norveška', 'Norway', 'OTHER_EUROPE'),
    ('RU', 'Rusija', 'Russia', 'OTHER_EUROPE'),
    ('SM', 'San Marino', 'San Marino', 'OTHER_EUROPE'),
    ('RS', 'Srbija', 'Serbia', 'OTHER_EUROPE'),
    ('CH', 'Švicarska', 'Switzerland', 'OTHER_EUROPE'),
    ('TR', 'Turska', 'Türkiye', 'OTHER_EUROPE'),
    ('UA', 'Ukrajina', 'Ukraine', 'OTHER_EUROPE'),
    ('GB', 'Ujedinjena Kraljevina', 'United Kingdom', 'OTHER_EUROPE'),
    ('VA', 'Vatikan', 'Vatican City', 'OTHER_EUROPE')
ON CONFLICT (iso2_code) DO UPDATE
SET name_hr = EXCLUDED.name_hr,
    name_en = EXCLUDED.name_en,
    region = EXCLUDED.region;
