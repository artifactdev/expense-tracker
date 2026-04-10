import { Readable } from 'stream';

import csv from 'csv-parser';
import { NextRequest, NextResponse } from 'next/server';

import type { TransactionBulk } from '@/types';
import { errorMessages, FIELDS_FROM_CSV, MULTI_COLUMN_FIELDS } from '@/utils/const';
import { getTransactionsCategories } from '@/utils/get-transactions-categories';
import { guessCSVDelimiter } from '@/utils/guess-csv-delimiter';

// Parse mapping value: multi-column fields are JSON arrays, others plain strings
const parseMappingValue = (field: string, raw: string): string | string[] => {
  if (MULTI_COLUMN_FIELDS.has(field)) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* not JSON, treat as single column */
    }
    return [raw];
  }
  return raw;
};

// Read one or more CSV columns and join non-empty values
const readColumns = (data: Record<string, string>, mapping: string | string[]): string => {
  if (typeof mapping === 'string') return data[mapping] ?? '';
  return mapping
    .map(col => (data[col] ?? '').trim())
    .filter(Boolean)
    .join(' ');
};

export const POST = async (req: NextRequest) => {
  const formData = await req.formData();
  const rawMappings = Object.fromEntries(formData) as Record<string, string>;
  const csvFiles: File[] = formData.getAll('files') as File[];

  if (!csvFiles || csvFiles.some(csvFile => csvFile.type !== 'text/csv')) {
    return NextResponse.json({ ok: false, error: errorMessages.fileType }, { status: 400 });
  }

  // Parse mappings (multi-column fields are JSON arrays)
  const mappedValues: Record<string, string | string[]> = {};
  for (const field of FIELDS_FROM_CSV) {
    const raw = rawMappings[field];
    if (raw) {
      mappedValues[field] = parseMappingValue(field, raw);
    }
  }

  let allParsedResults: Partial<TransactionBulk>[] = [];

  const processFile = async (file: File) => {
    const results: TransactionBulk[] = [];

    return new Promise<Partial<TransactionBulk>[]>(async (resolve, reject) => {
      const fileContent = await file.text();
      const firstLine = fileContent.split('\n')[0];
      const guessedDelimiter = guessCSVDelimiter(firstLine);

      const csvReadableStream = new Readable();
      csvReadableStream._read = () => {};
      csvReadableStream.push(Buffer.from(await file.arrayBuffer()));
      csvReadableStream.push(null);

      csvReadableStream
        .pipe(csv({ separator: guessedDelimiter }))
        .on('data', data => {
          const transformedData: Partial<TransactionBulk> = {};

          for (const field of FIELDS_FROM_CSV) {
            const mapping = mappedValues[field];
            if (!mapping) continue;

            const value = readColumns(data, mapping);
            if (value) {
              (transformedData as Record<string, unknown>)[field] = value;
            }

            // Directly categorize based on Concept + Counterparty
            if (field === 'Concept') {
              const conceptForCat = [value, readColumns(data, mappedValues['Counterparty'] ?? '')]
                .filter(Boolean)
                .join(' ');
              transformedData.selectedCategories = getTransactionsCategories(conceptForCat);
            }
          }

          // Vorzeichen anhand CdtDbtInd setzen: DBIT = negativ (Ausgabe)
          if (transformedData.CreditDebit && transformedData.Amount) {
            const isDebit = transformedData.CreditDebit.trim().toUpperCase() === 'DBIT';
            const rawAmt = parseFloat(String(transformedData.Amount).replace(',', '.'));
            if (!isNaN(rawAmt)) {
              transformedData.Amount = isDebit
                ? String(-Math.abs(rawAmt))
                : String(Math.abs(rawAmt));
            }
          }

          results.push(transformedData as TransactionBulk);
        })
        .on('end', () => resolve(results))
        .on('error', err => reject(err));
    });
  };
  for (const eachFile of csvFiles) {
    try {
      const parsedResults = await processFile(eachFile);
      allParsedResults = allParsedResults.concat(parsedResults);
    } catch (err) {
      console.log('ERROR PARSING CSVs', err);
      return NextResponse.json({ ok: false, error: errorMessages.fileParsing }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, data: allParsedResults }, { status: 200 });
};
