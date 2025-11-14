import rawData from "./german_flashcards.json";

export interface Flashcard {
  category: string;
  german: string;
  english: string | null;
  image_url: string;
  image_local: string;
}

const flashcards: Flashcard[] = rawData as Flashcard[];

export interface Category {
  id: string;    // slug (e.g. "german-action-verbs-flashcards")
  label: string; // original category name
}

/**
 * Slugifies a string by converting to lowercase, replacing spaces with hyphens,
 * and removing special characters.
 */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-')  // Replace spaces, underscores, and multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '');  // Remove leading/trailing hyphens
}

/**
 * Get all unique categories from the flashcards.
 * @returns Array of Category objects with slugified IDs and original labels
 */
export function getCategories(): Category[] {
  const categorySet = new Set<string>();
  
  flashcards.forEach(flashcard => {
    if (flashcard.category) {
      categorySet.add(flashcard.category);
    }
  });

  return Array.from(categorySet).map(category => ({
    id: slugify(category),
    label: category,
  }));
}

/**
 * Get all flashcards for a specific category by its slug ID.
 * @param categoryId - The slugified category ID
 * @returns Array of flashcards matching the category
 */
export function getFlashcardsForCategory(categoryId: string): Flashcard[] {
  const categories = getCategories();
  const category = categories.find(cat => cat.id === categoryId);
  
  if (!category) {
    return [];
  }

  return flashcards.filter(flashcard => flashcard.category === category.label);
}

export { flashcards };

