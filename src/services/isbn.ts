/**
 * ISBN Lookup Service using Open Library API (free, no API key required)
 */

interface OpenLibraryBookData {
  title?: string;
  authors?: Array<{ name: string }>;
  publishers?: string[];
  publish_date?: string;
  number_of_pages?: number;
  covers?: number[];
  description?: string | { value: string };
}

interface ISBNLookupResult {
  success: boolean;
  data?: {
    title: string;
    author: string | null;
    publisher: string | null;
    publishedYear: number | null;
    pageCount: number | null;
    coverUrl: string | null;
    description: string | null;
  };
  error?: string;
}

/**
 * Look up book information by ISBN using Open Library API
 */
export async function lookupISBN(isbn: string): Promise<ISBNLookupResult> {
  // Clean the ISBN (remove dashes and spaces)
  const cleanIsbn = isbn.replace(/[-\s]/g, '');

  // Validate ISBN format (10 or 13 digits)
  if (!/^(\d{10}|\d{13})$/.test(cleanIsbn)) {
    return {
      success: false,
      error: 'Invalid ISBN format. Please enter a 10 or 13 digit ISBN.',
    };
  }

  try {
    // Try Open Library API
    const response = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    const bookKey = `ISBN:${cleanIsbn}`;
    const bookData: OpenLibraryBookData | undefined = data[bookKey];

    if (!bookData || !bookData.title) {
      // Try alternative endpoint
      const altResponse = await fetch(
        `https://openlibrary.org/isbn/${cleanIsbn}.json`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (altResponse.ok) {
        const altData = await altResponse.json();
        if (altData.title) {
          // Get author info if available
          let authorName: string | null = null;
          if (altData.authors && altData.authors.length > 0) {
            const authorKey = altData.authors[0].key;
            const authorResponse = await fetch(`https://openlibrary.org${authorKey}.json`);
            if (authorResponse.ok) {
              const authorData = await authorResponse.json();
              authorName = authorData.name || null;
            }
          }

          return {
            success: true,
            data: {
              title: altData.title,
              author: authorName,
              publisher: altData.publishers?.[0] || null,
              publishedYear: extractYear(altData.publish_date),
              pageCount: altData.number_of_pages || null,
              coverUrl: altData.covers?.[0]
                ? `https://covers.openlibrary.org/b/id/${altData.covers[0]}-L.jpg`
                : null,
              description: typeof altData.description === 'string'
                ? altData.description
                : altData.description?.value || null,
            },
          };
        }
      }

      return {
        success: false,
        error: 'Book not found. Please enter the details manually.',
      };
    }

    return {
      success: true,
      data: {
        title: bookData.title,
        author: bookData.authors?.[0]?.name || null,
        publisher: bookData.publishers?.[0] || null,
        publishedYear: extractYear(bookData.publish_date),
        pageCount: bookData.number_of_pages || null,
        coverUrl: bookData.covers?.[0]
          ? `https://covers.openlibrary.org/b/id/${bookData.covers[0]}-L.jpg`
          : null,
        description: typeof bookData.description === 'string'
          ? bookData.description
          : (bookData.description as { value: string })?.value || null,
      },
    };
  } catch (error) {
    console.error('ISBN lookup error:', error);
    return {
      success: false,
      error: 'Failed to look up ISBN. Please check your connection and try again.',
    };
  }
}

/**
 * Extract year from various date formats
 */
function extractYear(dateStr?: string): number | null {
  if (!dateStr) return null;

  // Try to extract 4-digit year
  const yearMatch = dateStr.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    return parseInt(yearMatch[0]);
  }

  return null;
}
