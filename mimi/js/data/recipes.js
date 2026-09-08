/*
 * Mimi's recipe vault. Macros are per serving and are the numbers the nutrition
 * tab totals against a person's targets, so they are stored as plain grams and
 * calories rather than being recomputed from ingredients.
 */
export const RECIPE_TAGS = ['High protein', 'Low carb', 'Quick prep', 'Meals', 'Snacks', 'Desserts', 'Vegetarian', 'Batch cook']

export const RECIPES = [
  {
    id: 'harissa-chicken-bowl', title: 'Harissa chicken bowl', tags: ['High protein', 'Meals'],
    minutes: 25, serves: 2, kcal: 540, protein: 46, carbs: 48, fat: 18,
    ingredients: ['300g chicken breast, sliced', '2 tbsp rose harissa', '160g couscous', '1 red pepper', '100g cherry tomatoes', '2 tbsp Greek yoghurt', 'Lemon, salt, olive oil'],
    steps: ['Toss the chicken in the harissa and a pinch of salt, leave it while the pan heats.', 'Cook the chicken hard for six minutes until the edges catch, add the pepper for the last two.', 'Cover the couscous in boiling stock, lid on, five minutes, then fork it through.', 'Build the bowl, halved tomatoes on top, yoghurt and lemon over the lot.'],
  },
  {
    id: 'protein-oats', title: 'Overnight protein oats', tags: ['High protein', 'Quick prep', 'Batch cook'],
    minutes: 5, serves: 1, kcal: 420, protein: 34, carbs: 46, fat: 11,
    ingredients: ['50g rolled oats', '1 scoop vanilla protein', '150ml milk of choice', '100g Greek yoghurt', '1 tsp chia', 'Berries to finish'],
    steps: ['Stir everything except the berries in a jar.', 'Fridge overnight, or twenty minutes if you forgot.', 'Berries on in the morning.'],
  },
  {
    id: 'salmon-traybake', title: 'Salmon and greens traybake', tags: ['High protein', 'Meals'],
    minutes: 30, serves: 2, kcal: 610, protein: 42, carbs: 38, fat: 30,
    ingredients: ['2 salmon fillets', '400g baby potatoes, halved', '200g tenderstem broccoli', '1 lemon', 'Olive oil, garlic, chilli flakes'],
    steps: ['Potatoes in a hot oven, 200C, twenty minutes on their own.', 'Add the broccoli and the salmon, lemon slices on the fish.', 'Ten more minutes, until the salmon flakes at the thick end.'],
  },
  {
    id: 'turkey-meatballs', title: 'Turkey meatballs in tomato', tags: ['High protein', 'Meals', 'Batch cook'],
    minutes: 35, serves: 4, kcal: 480, protein: 44, carbs: 34, fat: 18,
    ingredients: ['500g turkey mince', '1 egg', '40g breadcrumbs', 'Oregano, salt', '2 tins chopped tomatoes', '1 onion, 3 cloves garlic', 'Basil'],
    steps: ['Mix mince, egg, crumbs and oregano, roll into sixteen.', 'Brown them in batches, set aside.', 'Soften onion and garlic, add tomatoes, simmer ten minutes.', 'Meatballs back in for fifteen, basil at the end. Freezes well.'],
  },
  {
    id: 'halloumi-grain-salad', title: 'Halloumi and grain salad', tags: ['Vegetarian', 'Meals', 'Quick prep'],
    minutes: 20, serves: 2, kcal: 560, protein: 27, carbs: 52, fat: 26,
    ingredients: ['180g halloumi', '250g cooked mixed grains', '1 courgette', 'Handful of rocket', 'Pomegranate seeds', 'Lemon, olive oil, mint'],
    steps: ['Griddle the courgette in ribbons until it marks.', 'Halloumi in the same pan, two minutes a side.', 'Toss grains with lemon, oil and mint, everything else on top.'],
  },
  {
    id: 'cottage-cheese-toast', title: 'Whipped cottage cheese toast', tags: ['High protein', 'Quick prep', 'Snacks', 'Vegetarian'],
    minutes: 6, serves: 1, kcal: 320, protein: 26, carbs: 30, fat: 10,
    ingredients: ['150g cottage cheese', '1 slice sourdough', 'Chilli honey or tomatoes', 'Black pepper'],
    steps: ['Blitz the cottage cheese for thirty seconds until it is smooth.', 'Toast, pile, top, pepper.'],
  },
  {
    id: 'protein-brownie', title: 'One bowl protein brownies', tags: ['Snacks', 'Batch cook', 'Vegetarian'],
    minutes: 25, serves: 9, kcal: 180, protein: 12, carbs: 18, fat: 7,
    ingredients: ['2 ripe bananas', '2 eggs', '60g cocoa', '2 scoops chocolate protein', '40g oat flour', '60g dark chocolate chips'],
    steps: ['Mash, mix, pour into a lined tin.', '180C for eighteen minutes, no longer, they set as they cool.'],
  },
  {
    id: 'green-shake', title: 'The green one', tags: ['Quick prep', 'Snacks', 'Vegetarian'],
    minutes: 3, serves: 1, kcal: 290, protein: 28, carbs: 30, fat: 6,
    ingredients: ['1 scoop vanilla protein', '1 frozen banana', 'Large handful spinach', '150ml milk', '1 tbsp nut butter', 'Ice'],
    steps: ['Blend until there is no spinach left to see.'],
  },
  {
    id: 'beef-stir-fry', title: 'Fifteen minute beef stir fry', tags: ['High protein', 'Quick prep', 'Meals'],
    minutes: 15, serves: 2, kcal: 520, protein: 45, carbs: 44, fat: 17,
    ingredients: ['350g lean beef strips', '2 nests egg noodles', '300g stir fry vegetables', 'Soy, ginger, garlic, sesame oil'],
    steps: ['Pan as hot as it goes, beef in a single layer, ninety seconds, out.', 'Vegetables in, two minutes, noodles and sauce, beef back for thirty seconds.'],
  },
  {
    id: 'lentil-dahl', title: 'Weeknight lentil dahl', tags: ['Vegetarian', 'Batch cook', 'Meals'],
    minutes: 30, serves: 4, kcal: 430, protein: 22, carbs: 58, fat: 12,
    ingredients: ['250g red lentils', '1 tin coconut milk', '400ml stock', 'Onion, garlic, ginger', 'Curry powder, turmeric, cumin', 'Spinach, lemon'],
    steps: ['Soften the aromatics, bloom the spices for a minute.', 'Lentils, coconut milk and stock in, simmer twenty five minutes.', 'Spinach through at the end, lemon to wake it up.'],
  },
  {
    id: 'egg-muffins', title: 'Feta and pepper egg muffins', tags: ['High protein', 'Low carb', 'Batch cook', 'Snacks', 'Vegetarian'],
    minutes: 25, serves: 6, kcal: 150, protein: 13, carbs: 4, fat: 10,
    ingredients: ['8 eggs', '80g feta', '1 red pepper', 'Spring onions', 'Salt and pepper'],
    steps: ['Whisk the eggs, fold in the rest.', 'Into a greased muffin tin, 180C for eighteen minutes.', 'Keeps four days in the fridge.'],
  },
  {
    id: 'chicken-pesto-pasta', title: 'Chicken pesto pasta', tags: ['High protein', 'Quick prep', 'Meals'],
    minutes: 18, serves: 2, kcal: 640, protein: 48, carbs: 64, fat: 20,
    ingredients: ['300g chicken thigh', '160g pasta', '3 tbsp pesto', '100g peas', '30g parmesan', 'Lemon zest'],
    steps: ['Pasta on, chicken in a hot pan until it is properly coloured.', 'Peas into the pasta water for the last two minutes.', 'Drain, keep a mugful of the water, stir pesto and a splash through everything.'],
  },
  {
    id: 'chicken-caesar-cups', title: 'Chicken Caesar lettuce cups', tags: ['High protein', 'Low carb', 'Quick prep', 'Meals'],
    minutes: 15, serves: 2, kcal: 390, protein: 44, carbs: 9, fat: 19,
    ingredients: ['300g cooked chicken breast', '2 baby gem lettuces', '3 tbsp Greek yoghurt', '1 tbsp mayonnaise', '20g parmesan', 'Anchovy, lemon, black pepper'],
    steps: ['Whisk yoghurt, mayonnaise, grated parmesan, a chopped anchovy and lemon into a dressing.', 'Shred the chicken through it.', 'Spoon into separated lettuce leaves, more parmesan over the top.'],
  },
  {
    id: 'steak-greens', title: 'Steak with garlic greens', tags: ['High protein', 'Low carb', 'Meals'],
    minutes: 20, serves: 2, kcal: 470, protein: 46, carbs: 8, fat: 27,
    ingredients: ['2 sirloin steaks', '200g green beans', '150g spinach', '3 cloves garlic', 'Butter, thyme, salt'],
    steps: ['Steaks out of the fridge twenty minutes early, salted.', 'Hot pan, three minutes a side for medium rare, butter and thyme in at the end.', 'Rest the steak while the greens go in the same pan with the garlic.'],
  },
  {
    id: 'choc-mousse', title: 'Two ingredient chocolate mousse', tags: ['Desserts', 'Quick prep', 'Vegetarian'],
    minutes: 10, serves: 2, kcal: 210, protein: 14, carbs: 16, fat: 9,
    ingredients: ['200g Greek yoghurt', '60g dark chocolate, melted', 'Pinch of salt', 'Berries to serve'],
    steps: ['Melt the chocolate and let it cool for a minute so it does not split the yoghurt.', 'Fold it through with the salt until it is glossy.', 'Fridge for twenty minutes. Berries on top.'],
  },
  {
    id: 'baked-cheesecake-pots', title: 'Protein cheesecake pots', tags: ['Desserts', 'High protein', 'Batch cook', 'Vegetarian'],
    minutes: 30, serves: 4, kcal: 240, protein: 22, carbs: 18, fat: 9,
    ingredients: ['300g quark', '150g cream cheese', '1 scoop vanilla protein', '2 eggs', '30g sweetener or honey', '2 digestives, crushed'],
    steps: ['Crushed biscuit into the base of four ramekins.', 'Blend everything else until smooth, pour on top.', '160C for twenty two minutes, they should still wobble.', 'Cool, then fridge. Better the next day.'],
  },
]

export const recipeById = (id) => RECIPES.find((r) => r.id === id) || null
