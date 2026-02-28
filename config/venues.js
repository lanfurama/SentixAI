/** All venues organized by concept. Single source of truth for venue configuration. */
export const VENUES = [
  // Supermarkets
  { id: '1', name: 'Mena Gourmet Market - Menas Mall Saigon Airport', concept: 'supermarket' },
  { id: '10', name: 'Mena Gourmet Market - Celesta Rise', concept: 'supermarket' },
  { id: '12', name: 'An Nam Gourmet Nguyễn Văn Trỗi', concept: 'supermarket' },
  { id: '11', name: 'Menas Mall Saigon Airport', concept: 'supermarket' },
  { id: '16', name: 'MenaWorld - Menas Mall', concept: 'supermarket' },
  { id: '21', name: 'Mena Gourmet market - 547 HTP', concept: 'supermarket' },
  { id: '23', name: 'Mena Gourmet Market -313 Nguyễn Thị Thập', concept: 'supermarket' },
  { id: '24', name: 'Siêu thị Emart - Phan Văn Trị', concept: 'supermarket' },
  { id: '25', name: 'Annam Gourmet Riverpark Premier', concept: 'supermarket' },
  { id: '26', name: 'Annam Gourmet - Saigon Centre - Takashimaya', concept: 'supermarket' },
  { id: '27', name: 'Annam Gourmet - Saigon Pearl', concept: 'supermarket' },
  { id: '28', name: 'Siêu thị Finelife Urban Hill', concept: 'supermarket' },
  { id: '29', name: 'Siêu thị Finelife Riviera Point', concept: 'supermarket' },
  { id: '31', name: 'LOTTE Mart Gò Vấp', concept: 'supermarket' },
  { id: '32', name: 'LOTTE Mart Quận 7', concept: 'supermarket' },
  { id: '33', name: 'AEON MALL TÂN PHÚ', concept: 'supermarket' },
  { id: '34', name: 'AEON MALL Bình Tân', concept: 'supermarket' },
  { id: '35', name: 'GO! Nguyễn Thị Thập', concept: 'supermarket' },
  { id: '36', name: 'GO! Gò Vấp', concept: 'supermarket' },

  // Retail Stores
  { id: '15', name: 'Mena Cosmetics & Perfumes', concept: 'retail' },
  { id: '17', name: 'Sky Shop - Menas Mall', concept: 'retail' },
  { id: '22', name: 'Saigon Oxford Bookstore - Menas Mall Saigon Airport', concept: 'retail' },

  // Dining & Venues
  { id: '13', name: "Don Cipriani's Italian Restaurant", concept: 'dining' },
  { id: '14', name: 'Lamue - Menas Mall', concept: 'dining' },
  { id: '18', name: 'The Fan', concept: 'dining' },
  { id: '19', name: 'V-Senses Dining Celesta Rise', concept: 'dining' },
  { id: '20', name: 'Yum Food', concept: 'dining' },
];

/**
 * Get all venues filtered by concept
 */
export function getVenuesByConcept(concept) {
  return VENUES.filter(v => v.concept === concept);
}

/**
 * Get a venue by its ID
 */
export function getVenueById(id) {
  return VENUES.find(v => v.id === id);
}

/**
 * Get all venue IDs for a specific concept
 */
export function getVenueIdsByConcept(concept) {
  return getVenuesByConcept(concept).map(v => v.id);
}
