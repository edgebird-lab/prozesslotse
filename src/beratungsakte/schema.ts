// Kopie der Bibliothek beratungsakte 1.0.1 (Format Beratungsakte v1).
// Nicht in dieser App ändern: Änderungen gehören in die Bibliothek und werden neu eingebunden.
// Aus schema/beratungsakte-v1.schema.json erzeugt (npm run schema). Nicht von Hand ändern.
export const SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:beratungsakte:schema:v1",
  "title": "Beratungsakte v1",
  "description": "Ergebnis einer Analyse für einen Mandanten: Kennzahlen, Befunde, Maßnahmen. Erweiterungen je App unter 'erweiterungen'.",
  "type": "object",
  "required": [
    "format",
    "formatVersion",
    "erzeugtVon",
    "erzeugtAm",
    "mandant",
    "analyse",
    "kennzahlen",
    "befunde",
    "massnahmen"
  ],
  "additionalProperties": false,
  "properties": {
    "format": {
      "const": "beratungsakte"
    },
    "formatVersion": {
      "type": "string",
      "pattern": "^1\\.[0-9]+$"
    },
    "erzeugtVon": {
      "type": "object",
      "required": [
        "app",
        "name",
        "version"
      ],
      "additionalProperties": false,
      "properties": {
        "app": {
          "$ref": "#/$defs/appKennung"
        },
        "name": {
          "$ref": "#/$defs/text"
        },
        "version": {
          "$ref": "#/$defs/text"
        }
      }
    },
    "erzeugtAm": {
      "type": "string",
      "format": "date-time",
      "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$"
    },
    "mandant": {
      "type": "object",
      "required": [
        "name"
      ],
      "additionalProperties": false,
      "properties": {
        "name": {
          "$ref": "#/$defs/text"
        },
        "kennung": {
          "$ref": "#/$defs/text"
        }
      }
    },
    "analyse": {
      "type": "object",
      "required": [
        "art",
        "titel",
        "stand"
      ],
      "additionalProperties": false,
      "properties": {
        "art": {
          "$ref": "#/$defs/appKennung"
        },
        "titel": {
          "$ref": "#/$defs/text"
        },
        "stand": {
          "$ref": "#/$defs/datum"
        },
        "quelldatei": {
          "$ref": "#/$defs/text"
        }
      }
    },
    "kennzahlen": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/kennzahl"
      }
    },
    "befunde": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/befund"
      }
    },
    "massnahmen": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/massnahme"
      }
    },
    "anhaenge": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/anhang"
      }
    },
    "erweiterungen": {
      "$ref": "#/$defs/erweiterungen"
    }
  },
  "$defs": {
    "text": {
      "type": "string",
      "minLength": 1,
      "pattern": "\\S"
    },
    "appKennung": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]{0,39}$"
    },
    "kennung": {
      "type": "string",
      "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$"
    },
    "datum": {
      "type": "string",
      "format": "date",
      "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"
    },
    "erweiterungen": {
      "description": "Je App ein Namensraum (Schlüssel = App-Kennung). Inhalt frei, Leser ignorieren fremde Namensräume.",
      "type": "object",
      "propertyNames": {
        "pattern": "^[a-z][a-z0-9-]{0,39}$"
      },
      "additionalProperties": {
        "type": "object"
      }
    },
    "kennzahl": {
      "type": "object",
      "required": [
        "name",
        "wert",
        "einheit"
      ],
      "additionalProperties": false,
      "properties": {
        "kennung": {
          "$ref": "#/$defs/kennung"
        },
        "name": {
          "$ref": "#/$defs/text"
        },
        "wert": {
          "type": [
            "number",
            "string"
          ]
        },
        "einheit": {
          "type": "string"
        },
        "bewertung": {
          "enum": [
            "gut",
            "mittel",
            "schlecht",
            "neutral"
          ]
        },
        "erweiterungen": {
          "$ref": "#/$defs/erweiterungen"
        }
      }
    },
    "befund": {
      "type": "object",
      "required": [
        "kennung",
        "schwere",
        "text",
        "fundstelle"
      ],
      "additionalProperties": false,
      "properties": {
        "kennung": {
          "$ref": "#/$defs/kennung"
        },
        "schwere": {
          "enum": [
            "kritisch",
            "hoch",
            "mittel",
            "niedrig",
            "hinweis"
          ]
        },
        "text": {
          "$ref": "#/$defs/text"
        },
        "fundstelle": {
          "$ref": "#/$defs/text"
        },
        "erweiterungen": {
          "$ref": "#/$defs/erweiterungen"
        }
      }
    },
    "massnahme": {
      "type": "object",
      "required": [
        "kennung",
        "text",
        "prioritaet",
        "aufwand",
        "befunde"
      ],
      "additionalProperties": false,
      "properties": {
        "kennung": {
          "$ref": "#/$defs/kennung"
        },
        "text": {
          "$ref": "#/$defs/text"
        },
        "prioritaet": {
          "enum": [
            "hoch",
            "mittel",
            "niedrig"
          ]
        },
        "aufwand": {
          "$ref": "#/$defs/text"
        },
        "befunde": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/kennung"
          }
        },
        "frist": {
          "$ref": "#/$defs/datum"
        },
        "erweiterungen": {
          "$ref": "#/$defs/erweiterungen"
        }
      }
    },
    "anhang": {
      "type": "object",
      "required": [
        "name",
        "verweis"
      ],
      "additionalProperties": false,
      "properties": {
        "name": {
          "$ref": "#/$defs/text"
        },
        "verweis": {
          "$ref": "#/$defs/text"
        },
        "medientyp": {
          "type": "string",
          "pattern": "^[a-z0-9.+-]+/[a-z0-9.+-]+$"
        }
      }
    }
  }
} as const
