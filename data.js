// ============================================================================
// Catalogs: glasses, methods, ingredients, garnishes
// All liquid measurements use the metric system (millilitres, ml).
// ============================================================================

// `tpl` selects the CSS shape template; `w`/`h` size the bowl (px);
// `cap` is the reference capacity (ml) used to scale the liquid fill;
// `stem` adds a stem + foot.
export const GLASSES = [
  { id: "rocks", name: "Rocks (Old Fashioned)", emoji: "🥃", tpl: "tumbler", w: 132, h: 120, cap: 220, stem: false, price: 9.5, blurb: "Short, heavy-bottomed tumbler for spirit-forward pours over ice." },
  { id: "highball", name: "Highball", emoji: "🥤", tpl: "tumbler", w: 96, h: 210, cap: 320, stem: false, price: 8, blurb: "Tall straight glass for long, mixer-topped drinks." },
  { id: "collins", name: "Collins", emoji: "🥤", tpl: "tumbler", w: 84, h: 240, cap: 360, stem: false, price: 8.5, blurb: "Slim and extra-tall — built for fizzy, refreshing pours." },
  { id: "coupe", name: "Coupe", emoji: "🍸", tpl: "bowl", w: 168, h: 96, cap: 200, stem: true, price: 12, blurb: "Vintage saucer-shaped stem glass for elegant shaken drinks." },
  { id: "martini", name: "Martini", emoji: "🍸", tpl: "cone", w: 184, h: 124, cap: 180, stem: true, price: 11, blurb: "The classic V-shaped stem glass for stirred, spirit-forward cocktails." },
  { id: "margarita", name: "Margarita", emoji: "🍹", tpl: "marg", w: 192, h: 116, cap: 250, stem: true, price: 13, blurb: "Wide-rimmed glass built for salt rims and citrus-forward cocktails." },
  { id: "hurricane", name: "Hurricane", emoji: "🍹", tpl: "hurricane", w: 122, h: 212, cap: 420, stem: true, price: 14.5, blurb: "Curvy, oversized glass for tropical and tiki-style drinks." },
  { id: "wine", name: "Wine", emoji: "🍷", tpl: "bowl", w: 140, h: 134, cap: 250, stem: true, price: 10, blurb: "All-purpose stemmed glass, also great for wine-based cocktails." },
  { id: "shot", name: "Shot", emoji: "🥃", tpl: "tumbler", w: 72, h: 82, cap: 60, stem: false, price: 4.5, blurb: "Small straight glass for shots and shooters." },
];

export const METHODS = [
  { id: "shake", name: "Shake", emoji: "🤝", hint: "Chill & combine with ice in a shaker." },
  { id: "stir", name: "Stir", emoji: "🥄", hint: "Gently stir with ice to chill & dilute." },
  { id: "build", name: "Build", emoji: "🧱", hint: "Build directly in the serving glass." },
  { id: "muddle", name: "Muddle", emoji: "🪵", hint: "Crush ingredients to release flavour." },
  { id: "blend", name: "Blend", emoji: "🌀", hint: "Blend with ice for a frozen drink." },
];

// ============================================================================
// Bartending tools — the gear used to make the drinks (never the liquids).
// `methods` lists which prep methods call for this tool, used to work out
// which tools the demo shop should suggest for a given recipe.
// ============================================================================
export const TOOLS = [
  { id: "jigger", name: "Jigger", emoji: "🥄", price: 7, blurb: "Double-sided measure for accurate pours, in every build.", methods: ["shake", "stir", "build", "muddle", "blend"] },
  { id: "shaker", name: "Cocktail Shaker", emoji: "🍸", price: 18, blurb: "Two- or three-piece tin for chilling and combining shaken drinks.", methods: ["shake"] },
  { id: "strainer", name: "Hawthorne Strainer", emoji: "🧊", price: 6.5, blurb: "Fits the shaker or mixing glass to hold back the ice on the pour.", methods: ["shake", "stir"] },
  { id: "mixing_glass", name: "Mixing Glass", emoji: "🥃", price: 15, blurb: "Heavy-bottomed glass for stirring spirit-forward cocktails.", methods: ["stir"] },
  { id: "bar_spoon", name: "Bar Spoon", emoji: "🥄", price: 6, blurb: "Long twisted spoon for stirring and layering.", methods: ["stir", "build", "muddle"] },
  { id: "muddler", name: "Muddler", emoji: "🪵", price: 8.5, blurb: "Presses fruit, herbs and sugar to release their flavour.", methods: ["muddle"] },
  { id: "blender", name: "Electric Blender", emoji: "🌀", price: 39, blurb: "Crushes ice for frozen, blended cocktails.", methods: ["blend"] },
];

// unit: "ml" for liquids, "dash" / "leaf" / "piece" for specials.
// color: liquid colour used for the pour/fill animation.
// mx: mixology metadata used by the Mixologist evaluator —
//   fam = role family, abv = % alcohol, sw/so/bi = sweet/sour/bitter (0..1),
//   pot = flavour potency multiplier, fizz = carbonated.
export const INGREDIENTS = [
  // Spirits
  { id: "white_rum", name: "White Rum", unit: "ml", cat: "Spirits", color: "#efe9d0", mx: { fam: "spirit", abv: 40, sw: 0, so: 0, bi: 0, pot: 1 } },
  { id: "dark_rum", name: "Dark Rum", unit: "ml", cat: "Spirits", color: "#7a431d", mx: { fam: "spirit", abv: 40, sw: 0.08, so: 0, bi: 0, pot: 1 } },
  { id: "gin", name: "Gin", unit: "ml", cat: "Spirits", color: "#e6eef0", mx: { fam: "spirit", abv: 42, sw: 0, so: 0, bi: 0.05, pot: 1 } },
  { id: "vodka", name: "Vodka", unit: "ml", cat: "Spirits", color: "#eaf2f6", mx: { fam: "spirit", abv: 40, sw: 0, so: 0, bi: 0, pot: 1 } },
  { id: "citron_vodka", name: "Citron Vodka", unit: "ml", cat: "Spirits", color: "#eaf0c8", mx: { fam: "spirit", abv: 38, sw: 0.03, so: 0.05, bi: 0, pot: 1 } },
  { id: "tequila", name: "Tequila", unit: "ml", cat: "Spirits", color: "#f1e7bf", mx: { fam: "spirit", abv: 40, sw: 0, so: 0, bi: 0, pot: 1 } },
  { id: "mezcal", name: "Mezcal", unit: "ml", cat: "Spirits", color: "#f0e8c8", mx: { fam: "spirit", abv: 45, sw: 0, so: 0, bi: 0.05, pot: 1 } },
  { id: "bourbon", name: "Bourbon", unit: "ml", cat: "Spirits", color: "#c06b22", mx: { fam: "spirit", abv: 45, sw: 0.05, so: 0, bi: 0, pot: 1 } },
  { id: "rye_whiskey", name: "Rye Whiskey", unit: "ml", cat: "Spirits", color: "#c77a2a", mx: { fam: "spirit", abv: 45, sw: 0.03, so: 0, bi: 0.05, pot: 1 } },
  { id: "cognac", name: "Cognac", unit: "ml", cat: "Spirits", color: "#9c5018", mx: { fam: "spirit", abv: 40, sw: 0.06, so: 0, bi: 0, pot: 1 } },

  // Liqueurs / fortified
  { id: "triple_sec", name: "Triple Sec", unit: "ml", cat: "Liqueurs", color: "#f2dd97", mx: { fam: "liqueur", abv: 30, sw: 0.8, so: 0.05, bi: 0, pot: 1.2 } },
  { id: "campari", name: "Campari", unit: "ml", cat: "Liqueurs", color: "#b11226", mx: { fam: "amaro", abv: 25, sw: 0.35, so: 0, bi: 0.8, pot: 1.4 } },
  { id: "aperol", name: "Aperol", unit: "ml", cat: "Liqueurs", color: "#ff7a18", mx: { fam: "amaro", abv: 11, sw: 0.5, so: 0.05, bi: 0.55, pot: 1.3 } },
  { id: "sweet_vermouth", name: "Sweet Vermouth", unit: "ml", cat: "Liqueurs", color: "#6e2c1c", mx: { fam: "aromatized", abv: 16, sw: 0.5, so: 0, bi: 0.2, pot: 1.1 } },
  { id: "dry_vermouth", name: "Dry Vermouth", unit: "ml", cat: "Liqueurs", color: "#e6ead0", mx: { fam: "aromatized", abv: 16, sw: 0.15, so: 0.05, bi: 0.2, pot: 1.1 } },
  { id: "coffee_liqueur", name: "Coffee Liqueur", unit: "ml", cat: "Liqueurs", color: "#34190e", mx: { fam: "liqueur", abv: 20, sw: 0.75, so: 0, bi: 0.2, pot: 1.2 } },
  { id: "amaretto", name: "Amaretto", unit: "ml", cat: "Liqueurs", color: "#8a4a23", mx: { fam: "liqueur", abv: 24, sw: 0.8, so: 0, bi: 0.05, pot: 1.2 } },
  { id: "maraschino", name: "Maraschino", unit: "ml", cat: "Liqueurs", color: "#efe9e0", mx: { fam: "liqueur", abv: 32, sw: 0.7, so: 0, bi: 0.05, pot: 1.3 } },
  { id: "elderflower", name: "Elderflower Liqueur", unit: "ml", cat: "Liqueurs", color: "#f0ead0", mx: { fam: "liqueur", abv: 20, sw: 0.8, so: 0.05, bi: 0, pot: 1.2 } },

  // Juices
  { id: "lime_juice", name: "Lime Juice", unit: "ml", cat: "Juices", color: "#b9d96a", mx: { fam: "citrus", abv: 0, sw: 0, so: 1, bi: 0, pot: 1 } },
  { id: "lemon_juice", name: "Lemon Juice", unit: "ml", cat: "Juices", color: "#eee46a", mx: { fam: "citrus", abv: 0, sw: 0, so: 1, bi: 0, pot: 1 } },
  { id: "grapefruit_juice", name: "Grapefruit Juice", unit: "ml", cat: "Juices", color: "#f2a285", mx: { fam: "citrus", abv: 0, sw: 0.1, so: 0.6, bi: 0.25, pot: 1 } },
  { id: "cranberry_juice", name: "Cranberry Juice", unit: "ml", cat: "Juices", color: "#a01234", mx: { fam: "juice", abv: 0, sw: 0.35, so: 0.45, bi: 0.1, pot: 1 } },
  { id: "orange_juice", name: "Orange Juice", unit: "ml", cat: "Juices", color: "#ff9a1f", mx: { fam: "juice", abv: 0, sw: 0.45, so: 0.3, bi: 0, pot: 1 } },
  { id: "pineapple_juice", name: "Pineapple Juice", unit: "ml", cat: "Juices", color: "#efc83f", mx: { fam: "juice", abv: 0, sw: 0.55, so: 0.35, bi: 0, pot: 1 } },

  // Mixers
  { id: "soda_water", name: "Soda Water", unit: "ml", cat: "Mixers", color: "#d7e9ef", mx: { fam: "soda", abv: 0, sw: 0, so: 0, bi: 0, pot: 1, fizz: 1 } },
  { id: "tonic_water", name: "Tonic Water", unit: "ml", cat: "Mixers", color: "#e6f1ec", mx: { fam: "soda", abv: 0, sw: 0.3, so: 0, bi: 0.35, pot: 1, fizz: 1 } },
  { id: "cola", name: "Cola", unit: "ml", cat: "Mixers", color: "#2f1b10", mx: { fam: "soda", abv: 0, sw: 0.6, so: 0.05, bi: 0.05, pot: 1, fizz: 1 } },
  { id: "ginger_beer", name: "Ginger Beer", unit: "ml", cat: "Mixers", color: "#dcae6a", mx: { fam: "soda", abv: 0, sw: 0.5, so: 0, bi: 0.1, pot: 1, fizz: 1 } },
  { id: "ginger_ale", name: "Ginger Ale", unit: "ml", cat: "Mixers", color: "#e8cf95", mx: { fam: "soda", abv: 0, sw: 0.55, so: 0, bi: 0.05, pot: 1, fizz: 1 } },
  { id: "prosecco", name: "Prosecco", unit: "ml", cat: "Mixers", color: "#efe2a3", mx: { fam: "sparkling", abv: 11, sw: 0.2, so: 0.1, bi: 0, pot: 1, fizz: 1 } },
  { id: "espresso", name: "Espresso", unit: "ml", cat: "Mixers", color: "#241009", mx: { fam: "coffee", abv: 0, sw: 0, so: 0.05, bi: 0.6, pot: 1.1 } },

  // Syrups & sweet
  { id: "sugar_syrup", name: "Sugar Syrup", unit: "ml", cat: "Syrups & Sweet", color: "#e3ddc8", mx: { fam: "syrup", abv: 0, sw: 1, so: 0, bi: 0, pot: 2 } },
  { id: "grenadine", name: "Grenadine", unit: "ml", cat: "Syrups & Sweet", color: "#9e0f2e", mx: { fam: "syrup", abv: 0, sw: 0.9, so: 0.1, bi: 0, pot: 2 } },
  { id: "honey_syrup", name: "Honey Syrup", unit: "ml", cat: "Syrups & Sweet", color: "#d9a534", mx: { fam: "syrup", abv: 0, sw: 0.9, so: 0, bi: 0, pot: 2 } },
  { id: "agave_syrup", name: "Agave Syrup", unit: "ml", cat: "Syrups & Sweet", color: "#d8c48a", mx: { fam: "syrup", abv: 0, sw: 0.9, so: 0, bi: 0, pot: 2 } },
  { id: "orgeat", name: "Orgeat (Almond)", unit: "ml", cat: "Syrups & Sweet", color: "#efe6d6", mx: { fam: "syrup", abv: 0, sw: 0.85, so: 0, bi: 0, pot: 2 } },

  // Bitters
  { id: "angostura", name: "Angostura Bitters", unit: "dash", cat: "Bitters", color: "#6f1b1b", mx: { fam: "bitters", abv: 44, sw: 0, so: 0, bi: 1, pot: 5 } },
  { id: "orange_bitters", name: "Orange Bitters", unit: "dash", cat: "Bitters", color: "#b5641a", mx: { fam: "bitters", abv: 40, sw: 0.05, so: 0, bi: 0.8, pot: 5 } },

  // Dairy & egg
  { id: "egg_white", name: "Egg White", unit: "piece", cat: "Dairy & Egg", color: "#f5f0e2", mx: { fam: "egg", abv: 0, sw: 0, so: 0, bi: 0, pot: 1 } },
  { id: "cream", name: "Cream", unit: "ml", cat: "Dairy & Egg", color: "#f6f1e3", mx: { fam: "dairy", abv: 0, sw: 0.2, so: 0, bi: 0, pot: 1 } },
  { id: "coconut_cream", name: "Coconut Cream", unit: "ml", cat: "Dairy & Egg", color: "#f3efe6", mx: { fam: "dairy", abv: 0, sw: 0.6, so: 0, bi: 0, pot: 1.2 } },

  // Herbs & spice
  { id: "mint", name: "Mint Leaves", unit: "leaf", cat: "Herbs & Spice", color: "#3f9140", mx: { fam: "herb", abv: 0, sw: 0, so: 0, bi: 0.1, pot: 3 } },
  { id: "hot_sauce", name: "Hot Sauce", unit: "dash", cat: "Herbs & Spice", color: "#b21e1e", mx: { fam: "spice", abv: 0, sw: 0, so: 0.1, bi: 0.3, pot: 4 } },

  // More spirits
  { id: "cachaca", name: "Cachaça", unit: "ml", cat: "Spirits", color: "#f0ead2", mx: { fam: "spirit", abv: 40, sw: 0, so: 0, bi: 0, pot: 1 } },
  { id: "scotch", name: "Scotch Whisky", unit: "ml", cat: "Spirits", color: "#c98a3a", mx: { fam: "spirit", abv: 40, sw: 0.03, so: 0, bi: 0.05, pot: 1 } },
  { id: "pisco", name: "Pisco", unit: "ml", cat: "Spirits", color: "#f3ecd8", mx: { fam: "spirit", abv: 40, sw: 0.02, so: 0, bi: 0, pot: 1 } },
  { id: "absinthe", name: "Absinthe", unit: "ml", cat: "Spirits", color: "#b6d99a", mx: { fam: "spirit", abv: 60, sw: 0, so: 0, bi: 0.3, pot: 3 } },

  // More liqueurs
  { id: "peach_schnapps", name: "Peach Schnapps", unit: "ml", cat: "Liqueurs", color: "#f6c98a", mx: { fam: "liqueur", abv: 18, sw: 0.8, so: 0.05, bi: 0, pot: 1.2 } },
  { id: "blue_curacao", name: "Blue Curaçao", unit: "ml", cat: "Liqueurs", color: "#1f8fd0", mx: { fam: "liqueur", abv: 24, sw: 0.8, so: 0.05, bi: 0, pot: 1.2 } },
  { id: "creme_de_cassis", name: "Crème de Cassis", unit: "ml", cat: "Liqueurs", color: "#5b1f3a", mx: { fam: "liqueur", abv: 15, sw: 0.9, so: 0.1, bi: 0, pot: 1.3 } },
  { id: "creme_de_violette", name: "Crème de Violette", unit: "ml", cat: "Liqueurs", color: "#7a5ea8", mx: { fam: "liqueur", abv: 20, sw: 0.8, so: 0, bi: 0, pot: 1.2 } },
  { id: "cherry_liqueur", name: "Cherry Liqueur", unit: "ml", cat: "Liqueurs", color: "#8e1f2a", mx: { fam: "liqueur", abv: 24, sw: 0.8, so: 0.05, bi: 0.05, pot: 1.2 } },
  { id: "raspberry_liqueur", name: "Raspberry Liqueur", unit: "ml", cat: "Liqueurs", color: "#6a0f33", mx: { fam: "liqueur", abv: 16, sw: 0.85, so: 0.1, bi: 0, pot: 1.3 } },
  { id: "drambuie", name: "Drambuie", unit: "ml", cat: "Liqueurs", color: "#b9742a", mx: { fam: "liqueur", abv: 40, sw: 0.7, so: 0, bi: 0.05, pot: 1.2 } },
  { id: "irish_cream", name: "Irish Cream", unit: "ml", cat: "Liqueurs", color: "#c8a978", mx: { fam: "liqueur", abv: 17, sw: 0.7, so: 0, bi: 0.05, pot: 1.2 } },

  // More juices
  { id: "tomato_juice", name: "Tomato Juice", unit: "ml", cat: "Juices", color: "#c0392b", mx: { fam: "juice", abv: 0, sw: 0.1, so: 0.3, bi: 0.1, pot: 1 } },
  { id: "passion_fruit", name: "Passion Fruit Purée", unit: "ml", cat: "Juices", color: "#f2a31a", mx: { fam: "juice", abv: 0, sw: 0.5, so: 0.5, bi: 0, pot: 1.1 } },
  { id: "peach_puree", name: "Peach Purée", unit: "ml", cat: "Juices", color: "#f4b073", mx: { fam: "juice", abv: 0, sw: 0.6, so: 0.2, bi: 0, pot: 1 } },

  // More syrups
  { id: "raspberry_syrup", name: "Raspberry Syrup", unit: "ml", cat: "Syrups & Sweet", color: "#9e1f44", mx: { fam: "syrup", abv: 0, sw: 0.9, so: 0.1, bi: 0, pot: 2 } },
];

export const GARNISHES = [
  { id: "none", name: "No Garnish", emoji: "🚫" },
  { id: "lime_wheel", name: "Lime Wheel", emoji: "🟢" },
  { id: "lemon_twist", name: "Lemon Twist", emoji: "🍋" },
  { id: "orange_peel", name: "Orange Peel", emoji: "🍊" },
  { id: "mint_sprig", name: "Mint Sprig", emoji: "🌿" },
  { id: "olive", name: "Olive", emoji: "🫒" },
  { id: "cherry", name: "Cocktail Cherry", emoji: "🍒" },
  { id: "coffee_beans", name: "Coffee Beans", emoji: "🫘" },
  { id: "salt_rim", name: "Salt Rim", emoji: "🧂" },
  { id: "pineapple_wedge", name: "Pineapple Wedge", emoji: "🍍" },
];

// ============================================================================
// Recipes (the stages). Difficulty ascends down the list.
// `ingredients` is a list of { id, amount } in the ingredient's own unit.
// `garnish` lists acceptable garnish ids (first one shown as the "ideal").
// ============================================================================

export const RECIPES = [
  // ---- Easy builds (pour & stir, no technique) ----
  {
    id: "gin_tonic",
    name: "Gin & Tonic",
    order: "Crisp and clean — a measure of gin, plenty of tonic over ice, with lime.",
    glass: "highball",
    method: "build",
    ingredients: [
      { id: "gin", amount: 50 },
      { id: "tonic_water", amount: 150 },
    ],
    garnish: ["lime_wheel"],
  },
  {
    id: "screwdriver",
    name: "Screwdriver",
    order: "The simplest classic — vodka and fresh orange juice over ice.",
    glass: "highball",
    method: "build",
    ingredients: [
      { id: "vodka", amount: 50 },
      { id: "orange_juice", amount: 120 },
    ],
    garnish: ["orange_peel"],
  },
  {
    id: "cuba_libre",
    name: "Cuba Libre",
    order: "Rum and cola lifted with a squeeze of lime. Built tall over ice.",
    glass: "highball",
    method: "build",
    ingredients: [
      { id: "white_rum", amount: 50 },
      { id: "cola", amount: 120 },
      { id: "lime_juice", amount: 10 },
    ],
    garnish: ["lime_wheel"],
  },
  {
    id: "moscow_mule",
    name: "Moscow Mule",
    order: "Spicy ginger beer, vodka and lime, built over ice. Served long.",
    glass: "collins",
    method: "build",
    ingredients: [
      { id: "vodka", amount: 50 },
      { id: "lime_juice", amount: 15 },
      { id: "ginger_beer", amount: 120 },
    ],
    garnish: ["lime_wheel"],
  },
  {
    id: "dark_n_stormy",
    name: "Dark 'n' Stormy",
    order: "Dark rum floated over spicy ginger beer with a hit of lime.",
    glass: "highball",
    method: "build",
    ingredients: [
      { id: "dark_rum", amount: 50 },
      { id: "ginger_beer", amount: 120 },
      { id: "lime_juice", amount: 10 },
    ],
    garnish: ["lime_wheel"],
  },
  {
    id: "tequila_sunrise",
    name: "Tequila Sunrise",
    order: "Tequila and orange juice with grenadine sinking to the bottom.",
    glass: "highball",
    method: "build",
    ingredients: [
      { id: "tequila", amount: 45 },
      { id: "orange_juice", amount: 90 },
      { id: "grenadine", amount: 15 },
    ],
    garnish: ["orange_peel"],
  },
  {
    id: "paloma",
    name: "Paloma",
    order: "Tequila with tart grapefruit, lime and a splash of soda. Mexico's favourite.",
    glass: "highball",
    method: "build",
    ingredients: [
      { id: "tequila", amount: 50 },
      { id: "grapefruit_juice", amount: 60 },
      { id: "lime_juice", amount: 10 },
      { id: "soda_water", amount: 60 },
    ],
    garnish: ["lime_wheel"],
  },
  {
    id: "mimosa",
    name: "Mimosa",
    order: "Equal parts sparkling wine and orange juice. Brunch in a glass.",
    glass: "coupe",
    method: "build",
    ingredients: [
      { id: "prosecco", amount: 90 },
      { id: "orange_juice", amount: 90 },
    ],
    garnish: ["orange_peel"],
  },
  {
    id: "bellini",
    name: "Bellini",
    order: "Peach purée topped gently with prosecco. A Venetian icon.",
    glass: "coupe",
    method: "build",
    ingredients: [
      { id: "peach_puree", amount: 50 },
      { id: "prosecco", amount: 100 },
    ],
    garnish: ["none"],
  },
  {
    id: "kir_royale",
    name: "Kir Royale",
    order: "A whisper of blackcurrant liqueur lifted by sparkling wine.",
    glass: "coupe",
    method: "build",
    ingredients: [
      { id: "creme_de_cassis", amount: 10 },
      { id: "prosecco", amount: 120 },
    ],
    garnish: ["none"],
  },
  {
    id: "black_russian",
    name: "Black Russian",
    order: "Just vodka and coffee liqueur, built over ice. Dark and simple.",
    glass: "rocks",
    method: "build",
    ingredients: [
      { id: "vodka", amount: 50 },
      { id: "coffee_liqueur", amount: 25 },
    ],
    garnish: ["none"],
  },
  {
    id: "white_russian",
    name: "White Russian",
    order: "Vodka and coffee liqueur with a float of cream. The Dude abides.",
    glass: "rocks",
    method: "build",
    ingredients: [
      { id: "vodka", amount: 50 },
      { id: "coffee_liqueur", amount: 20 },
      { id: "cream", amount: 30 },
    ],
    garnish: ["none"],
  },
  {
    id: "americano",
    name: "Americano",
    order: "Campari and sweet vermouth lengthened with soda. A bittersweet long drink.",
    glass: "highball",
    method: "build",
    ingredients: [
      { id: "campari", amount: 30 },
      { id: "sweet_vermouth", amount: 30 },
      { id: "soda_water", amount: 90 },
    ],
    garnish: ["orange_peel"],
  },
  {
    id: "aperol_spritz",
    name: "Aperol Spritz",
    order: "3-2-1: prosecco, Aperol and a splash of soda over ice. Aperitivo hour.",
    glass: "wine",
    method: "build",
    ingredients: [
      { id: "aperol", amount: 60 },
      { id: "prosecco", amount: 90 },
      { id: "soda_water", amount: 30 },
    ],
    garnish: ["orange_peel"],
  },
  {
    id: "tom_collins",
    name: "Tom Collins",
    order: "Gin, lemon and sugar lengthened with soda over ice. Tall and refreshing.",
    glass: "collins",
    method: "build",
    ingredients: [
      { id: "gin", amount: 50 },
      { id: "lemon_juice", amount: 25 },
      { id: "sugar_syrup", amount: 15 },
      { id: "soda_water", amount: 60 },
    ],
    garnish: ["lemon_twist"],
  },
  {
    id: "sex_on_the_beach",
    name: "Sex on the Beach",
    order: "Vodka and peach schnapps with orange and cranberry. Fruity and easy.",
    glass: "highball",
    method: "build",
    ingredients: [
      { id: "vodka", amount: 40 },
      { id: "peach_schnapps", amount: 20 },
      { id: "orange_juice", amount: 60 },
      { id: "cranberry_juice", amount: 60 },
    ],
    garnish: ["orange_peel"],
  },
  {
    id: "blue_lagoon",
    name: "Blue Lagoon",
    order: "Vodka and electric-blue curaçao lengthened with lemon and soda.",
    glass: "highball",
    method: "build",
    ingredients: [
      { id: "vodka", amount: 40 },
      { id: "blue_curacao", amount: 20 },
      { id: "lemon_juice", amount: 15 },
      { id: "soda_water", amount: 90 },
    ],
    garnish: ["lemon_twist"],
  },
  {
    id: "bramble",
    name: "Bramble",
    order: "Gin sour built over crushed ice, drizzled with berry liqueur.",
    glass: "rocks",
    method: "build",
    ingredients: [
      { id: "gin", amount: 50 },
      { id: "lemon_juice", amount: 25 },
      { id: "sugar_syrup", amount: 12 },
      { id: "raspberry_liqueur", amount: 15 },
    ],
    garnish: ["lemon_twist"],
  },
  {
    id: "bloody_mary",
    name: "Bloody Mary",
    order: "Vodka and tomato juice with lemon and a few dashes of hot sauce. Savoury and bold.",
    glass: "highball",
    method: "build",
    ingredients: [
      { id: "vodka", amount: 45 },
      { id: "tomato_juice", amount: 90 },
      { id: "lemon_juice", amount: 15 },
      { id: "hot_sauce", amount: 2 },
    ],
    garnish: ["lime_wheel"],
  },
  {
    id: "godfather",
    name: "Godfather",
    order: "Scotch sweetened with a measure of amaretto, over ice. Two ingredients, big flavour.",
    glass: "rocks",
    method: "build",
    ingredients: [
      { id: "scotch", amount: 45 },
      { id: "amaretto", amount: 25 },
    ],
    garnish: ["none"],
  },
  {
    id: "long_island",
    name: "Long Island Iced Tea",
    order: "Five spirits, lemon and a top of cola. Deceptively easy-drinking — go careful.",
    glass: "highball",
    method: "build",
    ingredients: [
      { id: "vodka", amount: 15 },
      { id: "gin", amount: 15 },
      { id: "white_rum", amount: 15 },
      { id: "tequila", amount: 15 },
      { id: "triple_sec", amount: 15 },
      { id: "lemon_juice", amount: 25 },
      { id: "cola", amount: 60 },
    ],
    garnish: ["lemon_twist"],
  },

  // ---- Shaken sours (citrus, technique) ----
  {
    id: "daiquiri",
    name: "Daiquiri",
    order: "A crisp, tart classic — clean rum, lime and a touch of sweetness, served up.",
    glass: "coupe",
    method: "shake",
    ingredients: [
      { id: "white_rum", amount: 60 },
      { id: "lime_juice", amount: 25 },
      { id: "sugar_syrup", amount: 15 },
    ],
    garnish: ["lime_wheel"],
  },
  {
    id: "margarita",
    name: "Margarita",
    order: "Tequila, orange liqueur and lime — shaken, with a salted rim.",
    glass: "margarita",
    method: "shake",
    ingredients: [
      { id: "tequila", amount: 50 },
      { id: "triple_sec", amount: 20 },
      { id: "lime_juice", amount: 20 },
    ],
    garnish: ["salt_rim", "lime_wheel"],
  },
  {
    id: "gimlet",
    name: "Gimlet",
    order: "Gin sharpened with lime and a little sugar, shaken and served up.",
    glass: "coupe",
    method: "shake",
    ingredients: [
      { id: "gin", amount: 60 },
      { id: "lime_juice", amount: 20 },
      { id: "sugar_syrup", amount: 15 },
    ],
    garnish: ["lime_wheel"],
  },
  {
    id: "whiskey_sour",
    name: "Whiskey Sour",
    order: "Bourbon, lemon and sugar with a silky egg-white foam. Shaken hard.",
    glass: "rocks",
    method: "shake",
    ingredients: [
      { id: "bourbon", amount: 60 },
      { id: "lemon_juice", amount: 25 },
      { id: "sugar_syrup", amount: 15 },
      { id: "egg_white", amount: 1 },
    ],
    garnish: ["cherry", "lemon_twist"],
  },
  {
    id: "amaretto_sour",
    name: "Amaretto Sour",
    order: "Nutty amaretto balanced by lemon and a glossy egg-white foam.",
    glass: "rocks",
    method: "shake",
    ingredients: [
      { id: "amaretto", amount: 50 },
      { id: "lemon_juice", amount: 25 },
      { id: "sugar_syrup", amount: 10 },
      { id: "egg_white", amount: 1 },
    ],
    garnish: ["cherry"],
  },
  {
    id: "cosmopolitan",
    name: "Cosmopolitan",
    order: "Citron vodka, triple sec, lime and a splash of cranberry — shaken and served up.",
    glass: "martini",
    method: "shake",
    ingredients: [
      { id: "citron_vodka", amount: 45 },
      { id: "triple_sec", amount: 15 },
      { id: "lime_juice", amount: 15 },
      { id: "cranberry_juice", amount: 30 },
    ],
    garnish: ["lime_wheel"],
  },
  {
    id: "french_75",
    name: "French 75",
    order: "Gin, lemon and sugar shaken cold, then topped with sparkling wine. Elegant.",
    glass: "coupe",
    method: "shake",
    ingredients: [
      { id: "gin", amount: 30 },
      { id: "lemon_juice", amount: 15 },
      { id: "sugar_syrup", amount: 10 },
      { id: "prosecco", amount: 60 },
    ],
    garnish: ["lemon_twist"],
  },
  {
    id: "clover_club",
    name: "Clover Club",
    order: "Gin, lemon and raspberry shaken with egg white to a pink, frothy finish.",
    glass: "coupe",
    method: "shake",
    ingredients: [
      { id: "gin", amount: 45 },
      { id: "lemon_juice", amount: 15 },
      { id: "raspberry_syrup", amount: 15 },
      { id: "egg_white", amount: 1 },
    ],
    garnish: ["cherry"],
  },
  {
    id: "pisco_sour",
    name: "Pisco Sour",
    order: "Pisco, lemon and sugar shaken with egg white, finished with bitters on the foam.",
    glass: "coupe",
    method: "shake",
    ingredients: [
      { id: "pisco", amount: 60 },
      { id: "lemon_juice", amount: 25 },
      { id: "sugar_syrup", amount: 20 },
      { id: "egg_white", amount: 1 },
      { id: "angostura", amount: 2 },
    ],
    garnish: ["none"],
  },
  {
    id: "aviation",
    name: "Aviation",
    order: "Gin, maraschino and a touch of violette with lemon — a pale lavender sour.",
    glass: "coupe",
    method: "shake",
    ingredients: [
      { id: "gin", amount: 45 },
      { id: "maraschino", amount: 15 },
      { id: "creme_de_violette", amount: 10 },
      { id: "lemon_juice", amount: 15 },
    ],
    garnish: ["cherry"],
  },
  {
    id: "corpse_reviver",
    name: "Corpse Reviver #2",
    order: "Equal parts gin, triple sec, dry vermouth and lemon with an absinthe rinse.",
    glass: "coupe",
    method: "shake",
    ingredients: [
      { id: "gin", amount: 25 },
      { id: "triple_sec", amount: 25 },
      { id: "dry_vermouth", amount: 25 },
      { id: "lemon_juice", amount: 25 },
      { id: "absinthe", amount: 2 },
    ],
    garnish: ["cherry"],
  },

  // ---- Stirred & spirit-forward ----
  {
    id: "negroni",
    name: "Negroni",
    order: "Equal parts, bittersweet and stirred over ice. A bracing aperitivo.",
    glass: "rocks",
    method: "stir",
    ingredients: [
      { id: "gin", amount: 30 },
      { id: "campari", amount: 30 },
      { id: "sweet_vermouth", amount: 30 },
    ],
    garnish: ["orange_peel"],
  },
  {
    id: "boulevardier",
    name: "Boulevardier",
    order: "A Negroni's whiskey cousin — bourbon, Campari and sweet vermouth, stirred.",
    glass: "rocks",
    method: "stir",
    ingredients: [
      { id: "bourbon", amount: 30 },
      { id: "campari", amount: 30 },
      { id: "sweet_vermouth", amount: 30 },
    ],
    garnish: ["orange_peel"],
  },
  {
    id: "rob_roy",
    name: "Rob Roy",
    order: "A Manhattan made with Scotch — stirred with sweet vermouth and bitters.",
    glass: "coupe",
    method: "stir",
    ingredients: [
      { id: "scotch", amount: 60 },
      { id: "sweet_vermouth", amount: 25 },
      { id: "angostura", amount: 2 },
    ],
    garnish: ["cherry"],
  },
  {
    id: "rusty_nail",
    name: "Rusty Nail",
    order: "Scotch sweetened with honeyed Drambuie, stirred down over ice.",
    glass: "rocks",
    method: "stir",
    ingredients: [
      { id: "scotch", amount: 45 },
      { id: "drambuie", amount: 25 },
    ],
    garnish: ["lemon_twist"],
  },
  {
    id: "old_fashioned",
    name: "Old Fashioned",
    order: "Bourbon, a little sugar and bitters, stirred down over ice. Timeless.",
    glass: "rocks",
    method: "stir",
    ingredients: [
      { id: "bourbon", amount: 60 },
      { id: "sugar_syrup", amount: 10 },
      { id: "angostura", amount: 2 },
    ],
    garnish: ["orange_peel"],
  },
  {
    id: "manhattan",
    name: "Manhattan",
    order: "Rye and sweet vermouth, stirred down with a couple dashes of bitters, served up.",
    glass: "coupe",
    method: "stir",
    ingredients: [
      { id: "rye_whiskey", amount: 60 },
      { id: "sweet_vermouth", amount: 25 },
      { id: "angostura", amount: 2 },
    ],
    garnish: ["cherry"],
  },
  {
    id: "sazerac",
    name: "Sazerac",
    order: "Rye and sugar stirred with bitters in an absinthe-rinsed glass. New Orleans royalty.",
    glass: "rocks",
    method: "stir",
    ingredients: [
      { id: "rye_whiskey", amount: 60 },
      { id: "sugar_syrup", amount: 10 },
      { id: "angostura", amount: 3 },
      { id: "absinthe", amount: 2 },
    ],
    garnish: ["lemon_twist"],
  },
  {
    id: "dry_martini",
    name: "Dry Martini",
    order: "Gin kissed with dry vermouth, stirred ice-cold and served up. Pure finesse.",
    glass: "martini",
    method: "stir",
    ingredients: [
      { id: "gin", amount: 60 },
      { id: "dry_vermouth", amount: 10 },
    ],
    garnish: ["olive", "lemon_twist"],
  },

  // ---- Muddled ----
  {
    id: "mojito",
    name: "Mojito",
    order: "Muddle mint with lime and sugar, build over ice with rum, top with soda.",
    glass: "collins",
    method: "muddle",
    ingredients: [
      { id: "white_rum", amount: 60 },
      { id: "lime_juice", amount: 30 },
      { id: "sugar_syrup", amount: 20 },
      { id: "soda_water", amount: 60 },
      { id: "mint", amount: 8 },
    ],
    garnish: ["mint_sprig"],
  },
  {
    id: "caipirinha",
    name: "Caipirinha",
    order: "Muddle lime and sugar, then drown in cachaça over crushed ice. Brazil's national drink.",
    glass: "rocks",
    method: "muddle",
    ingredients: [
      { id: "cachaca", amount: 60 },
      { id: "lime_juice", amount: 30 },
      { id: "sugar_syrup", amount: 20 },
    ],
    garnish: ["lime_wheel"],
  },
  {
    id: "mint_julep",
    name: "Mint Julep",
    order: "Muddle mint with sugar, pack with crushed ice and pour over bourbon. Derby day.",
    glass: "rocks",
    method: "muddle",
    ingredients: [
      { id: "bourbon", amount: 60 },
      { id: "sugar_syrup", amount: 15 },
      { id: "mint", amount: 10 },
    ],
    garnish: ["mint_sprig"],
  },

  // ---- Tiki, frozen & advanced ----
  {
    id: "mai_tai",
    name: "Mai Tai",
    order: "Two rums, orange liqueur, almond orgeat and lime — shaken. Tiki done right.",
    glass: "rocks",
    method: "shake",
    ingredients: [
      { id: "white_rum", amount: 40 },
      { id: "dark_rum", amount: 20 },
      { id: "triple_sec", amount: 15 },
      { id: "orgeat", amount: 15 },
      { id: "lime_juice", amount: 20 },
    ],
    garnish: ["mint_sprig", "lime_wheel"],
  },
  {
    id: "painkiller",
    name: "Painkiller",
    order: "Dark rum with pineapple, orange and coconut cream — shaken into a tropical haze.",
    glass: "hurricane",
    method: "shake",
    ingredients: [
      { id: "dark_rum", amount: 60 },
      { id: "pineapple_juice", amount: 90 },
      { id: "orange_juice", amount: 30 },
      { id: "coconut_cream", amount: 30 },
    ],
    garnish: ["pineapple_wedge"],
  },
  {
    id: "singapore_sling",
    name: "Singapore Sling",
    order: "Gin, cherry liqueur and a tangle of pineapple, lime and grenadine. A tropical epic.",
    glass: "hurricane",
    method: "shake",
    ingredients: [
      { id: "gin", amount: 30 },
      { id: "cherry_liqueur", amount: 15 },
      { id: "triple_sec", amount: 8 },
      { id: "pineapple_juice", amount: 60 },
      { id: "lime_juice", amount: 15 },
      { id: "grenadine", amount: 8 },
    ],
    garnish: ["cherry", "pineapple_wedge"],
  },
  {
    id: "hurricane_cocktail",
    name: "Hurricane",
    order: "Light and dark rum with passion fruit, citrus and grenadine. A New Orleans storm.",
    glass: "hurricane",
    method: "shake",
    ingredients: [
      { id: "white_rum", amount: 30 },
      { id: "dark_rum", amount: 30 },
      { id: "passion_fruit", amount: 30 },
      { id: "orange_juice", amount: 30 },
      { id: "lime_juice", amount: 15 },
      { id: "grenadine", amount: 10 },
    ],
    garnish: ["orange_peel", "cherry"],
  },
  {
    id: "pina_colada",
    name: "Piña Colada",
    order: "Rum, coconut cream and pineapple, blended frozen. A beach in a glass.",
    glass: "hurricane",
    method: "blend",
    ingredients: [
      { id: "white_rum", amount: 50 },
      { id: "coconut_cream", amount: 30 },
      { id: "pineapple_juice", amount: 90 },
    ],
    garnish: ["pineapple_wedge"],
  },
  {
    id: "espresso_martini",
    name: "Espresso Martini",
    order: "Vodka, coffee liqueur and fresh espresso — shaken hard for a silky foam.",
    glass: "martini",
    method: "shake",
    ingredients: [
      { id: "vodka", amount: 50 },
      { id: "coffee_liqueur", amount: 20 },
      { id: "espresso", amount: 30 },
      { id: "sugar_syrup", amount: 10 },
    ],
    garnish: ["coffee_beans"],
  },
  {
    id: "penicillin",
    name: "Penicillin",
    order: "Scotch with lemon and honey for a modern, smoky-sweet sour. Shaken.",
    glass: "rocks",
    method: "shake",
    ingredients: [
      { id: "scotch", amount: 60 },
      { id: "lemon_juice", amount: 20 },
      { id: "honey_syrup", amount: 20 },
    ],
    garnish: ["lemon_twist"],
  },
];

// ============================================================================
// Mocktails — alcohol-free drinks. These are the ONLY drinks shown to underage
// players, and are also available to everyone as a dedicated section.
// Ordered easy -> hard (by ingredient count & preparation complexity).
// ============================================================================
export const MOCKTAILS = [
  {
    id: "virgin_sunrise",
    name: "Virgin Sunrise",
    order: "Orange juice with grenadine sinking to the bottom — a sunrise in a glass.",
    glass: "highball",
    method: "build",
    ingredients: [
      { id: "orange_juice", amount: 150 },
      { id: "grenadine", amount: 15 },
    ],
    garnish: ["orange_peel"],
  },
  {
    id: "roy_rogers",
    name: "Roy Rogers",
    order: "Cola with a splash of grenadine and a cherry. A classic kids' favourite.",
    glass: "highball",
    method: "build",
    ingredients: [
      { id: "cola", amount: 150 },
      { id: "grenadine", amount: 15 },
    ],
    garnish: ["cherry"],
  },
  {
    id: "shirley_temple",
    name: "Shirley Temple",
    order: "Fizzy ginger ale with grenadine and a cocktail cherry.",
    glass: "highball",
    method: "build",
    ingredients: [
      { id: "ginger_ale", amount: 150 },
      { id: "grenadine", amount: 15 },
    ],
    garnish: ["cherry"],
  },
  {
    id: "virgin_pina_colada",
    name: "Virgin Piña Colada",
    order: "Pineapple and coconut cream blended frozen. A tropical treat, no rum.",
    glass: "hurricane",
    method: "blend",
    ingredients: [
      { id: "pineapple_juice", amount: 120 },
      { id: "coconut_cream", amount: 40 },
    ],
    garnish: ["pineapple_wedge"],
  },
  {
    id: "fresh_lemonade",
    name: "Fresh Lemonade",
    order: "Fresh lemon and sugar lengthened with soda over ice. Crisp and simple.",
    glass: "collins",
    method: "build",
    ingredients: [
      { id: "lemon_juice", amount: 30 },
      { id: "sugar_syrup", amount: 20 },
      { id: "soda_water", amount: 120 },
    ],
    garnish: ["lemon_twist"],
  },
  {
    id: "ginger_fizz",
    name: "Ginger Fizz",
    order: "Zingy ginger ale brightened with lime and a touch of sugar.",
    glass: "highball",
    method: "build",
    ingredients: [
      { id: "ginger_ale", amount: 120 },
      { id: "lime_juice", amount: 15 },
      { id: "sugar_syrup", amount: 10 },
    ],
    garnish: ["lime_wheel"],
  },
  {
    id: "berry_fizz",
    name: "Berry Fizz",
    order: "Raspberry syrup with lemon and soda — a bright, berry sparkler.",
    glass: "collins",
    method: "build",
    ingredients: [
      { id: "raspberry_syrup", amount: 20 },
      { id: "lemon_juice", amount: 15 },
      { id: "soda_water", amount: 120 },
    ],
    garnish: ["lemon_twist"],
  },
  {
    id: "virgin_mary",
    name: "Virgin Mary",
    order: "Savoury tomato juice with lemon and a few dashes of hot sauce. Bold and spicy.",
    glass: "highball",
    method: "build",
    ingredients: [
      { id: "tomato_juice", amount: 120 },
      { id: "lemon_juice", amount: 15 },
      { id: "hot_sauce", amount: 2 },
    ],
    garnish: ["lime_wheel"],
  },
  {
    id: "virgin_mojito",
    name: "Virgin Mojito",
    order: "Muddle mint with lime and sugar, top with soda. Refreshing, no rum.",
    glass: "collins",
    method: "muddle",
    ingredients: [
      { id: "lime_juice", amount: 25 },
      { id: "sugar_syrup", amount: 20 },
      { id: "soda_water", amount: 120 },
      { id: "mint", amount: 8 },
    ],
    garnish: ["mint_sprig"],
  },
  {
    id: "cinderella",
    name: "Cinderella",
    order: "Orange, pineapple and lemon shaken with a dash of grenadine. Fruity and fun.",
    glass: "highball",
    method: "shake",
    ingredients: [
      { id: "orange_juice", amount: 60 },
      { id: "pineapple_juice", amount: 60 },
      { id: "lemon_juice", amount: 15 },
      { id: "grenadine", amount: 10 },
    ],
    garnish: ["orange_peel"],
  },
  {
    id: "tropical_cooler",
    name: "Tropical Cooler",
    order: "Pineapple, orange and passion fruit shaken with lime. A holiday cooler.",
    glass: "hurricane",
    method: "shake",
    ingredients: [
      { id: "pineapple_juice", amount: 60 },
      { id: "orange_juice", amount: 40 },
      { id: "passion_fruit", amount: 20 },
      { id: "lime_juice", amount: 15 },
    ],
    garnish: ["pineapple_wedge"],
  },
  {
    id: "nojito_berry",
    name: "Berry Nojito",
    order: "Muddle mint with lime and raspberry syrup, top with soda. A berry twist.",
    glass: "collins",
    method: "muddle",
    ingredients: [
      { id: "raspberry_syrup", amount: 15 },
      { id: "lime_juice", amount: 20 },
      { id: "soda_water", amount: 120 },
      { id: "mint", amount: 6 },
    ],
    garnish: ["mint_sprig"],
  },
];

// ============================================================================
// Shots — small, punchy drinks served in a shot glass. Adults only.
// ============================================================================
export const SHOTS = [
  {
    id: "kamikaze",
    name: "Kamikaze",
    order: "Vodka, triple sec and lime — shaken and served in one sharp hit.",
    glass: "shot",
    method: "shake",
    ingredients: [
      { id: "vodka", amount: 20 },
      { id: "triple_sec", amount: 10 },
      { id: "lime_juice", amount: 10 },
    ],
    garnish: ["none"],
  },
  {
    id: "baby_guinness",
    name: "Baby Guinness",
    order: "Coffee liqueur topped with a float of Irish cream — looks like a tiny stout.",
    glass: "shot",
    method: "build",
    ingredients: [
      { id: "coffee_liqueur", amount: 30 },
      { id: "irish_cream", amount: 10 },
    ],
    garnish: ["none"],
  },
  {
    id: "lemon_drop_shot",
    name: "Lemon Drop",
    order: "Citron vodka with lemon and sugar — a zingy, sweet-tart shot.",
    glass: "shot",
    method: "shake",
    ingredients: [
      { id: "citron_vodka", amount: 20 },
      { id: "lemon_juice", amount: 10 },
      { id: "sugar_syrup", amount: 10 },
    ],
    garnish: ["lemon_twist"],
  },
  {
    id: "b52",
    name: "B-52",
    order: "Layered coffee liqueur, Irish cream and triple sec — pour gently to keep the bands.",
    glass: "shot",
    method: "build",
    ingredients: [
      { id: "coffee_liqueur", amount: 15 },
      { id: "irish_cream", amount: 15 },
      { id: "triple_sec", amount: 15 },
    ],
    garnish: ["none"],
  },
  {
    id: "green_tea_shot",
    name: "Green Tea Shot",
    order: "Whiskey, peach schnapps and lime topped with a splash of soda. Tastes like green tea.",
    glass: "shot",
    method: "shake",
    ingredients: [
      { id: "bourbon", amount: 20 },
      { id: "peach_schnapps", amount: 15 },
      { id: "lime_juice", amount: 10 },
      { id: "ginger_ale", amount: 15 },
    ],
    garnish: ["none"],
  },
];

// ============================================================================
// Judges — a rotating panel for the "invent a new mix" mode. 10 judges, each
// with their own palate (ideal levels 0..1 for strong/sweet/sour/bitter/fizz),
// how picky they are (weight), and how generous (bias). 3 judge a mix at a time.
// ============================================================================
export const JUDGES = [
  { id: "vera", name: "Vera Sterling", initials: "VS", title: "Silver-screen martini grande dame", blurb: "Classic martini purist", ideal: { strong: 0.85, sweet: 0.2, sour: 0.3, bitter: 0.4, fizz: 0.1 }, weight: 0.6, bias: -4 },
  { id: "sweet_lou", name: "Lou Marlowe", initials: "LM", title: "Lounge-showman with a sweet tooth", blurb: "Sweet tooth", ideal: { strong: 0.4, sweet: 0.85, sour: 0.4, bitter: 0.1, fizz: 0.4 }, weight: 0.65, bias: 4 },
  { id: "sour_sal", name: "Sal Delacroix", initials: "SD", title: "Rebel sour specialist", blurb: "Loves a sharp sour", ideal: { strong: 0.5, sweet: 0.4, sour: 0.85, bitter: 0.2, fizz: 0.2 }, weight: 0.6, bias: 0 },
  { id: "bitter_bo", name: "Beatrix Bardin", initials: "BB", title: "Velvet-dark amaro icon", blurb: "Amaro & bitters fan", ideal: { strong: 0.7, sweet: 0.25, sour: 0.3, bitter: 0.85, fizz: 0.1 }, weight: 0.65, bias: -2 },
  { id: "fizzy_fay", name: "Faye Bellini", initials: "FB", title: "Sparkling European glamour", blurb: "Spritz & bubbles", ideal: { strong: 0.35, sweet: 0.55, sour: 0.45, bitter: 0.2, fizz: 0.9 }, weight: 0.6, bias: 3 },
  { id: "tiki_tom", name: "Tommy Soleil", initials: "TS", title: "Tropical resort showman", blurb: "Tropical & fruity", ideal: { strong: 0.55, sweet: 0.7, sour: 0.6, bitter: 0.1, fizz: 0.2 }, weight: 0.55, bias: 2 },
  { id: "balanced_bea", name: "Bianca Vale", initials: "BV", title: "Precision fashion-editor palate", blurb: "Wants perfect balance", ideal: { strong: 0.55, sweet: 0.5, sour: 0.5, bitter: 0.35, fizz: 0.3 }, weight: 0.75, bias: 0 },
  { id: "boozy_bru", name: "Bruno Ryder", initials: "BR", title: "Aviator rogue who likes it strong", blurb: "Spirit-forward & strong", ideal: { strong: 0.95, sweet: 0.15, sour: 0.2, bitter: 0.45, fizz: 0.05 }, weight: 0.7, bias: -3 },
  { id: "easy_emma", name: "Emma Hartwell", initials: "EH", title: "Crowd-pleasing star with soft edges", blurb: "Easy-going crowd-pleaser", ideal: { strong: 0.45, sweet: 0.55, sour: 0.45, bitter: 0.25, fizz: 0.4 }, weight: 0.4, bias: 6 },
  { id: "critic_cyrus", name: "Cyrus Kane", initials: "CK", title: "Severe black-book critic", blurb: "Hard-to-impress critic", ideal: { strong: 0.6, sweet: 0.45, sour: 0.5, bitter: 0.5, fizz: 0.25 }, weight: 0.7, bias: -7 },
];

// ============================================================================
// Customers — the people who order drinks. Adds personality to each round.
// `lines` use {drink} as a placeholder for the cocktail name.
// ============================================================================
export const CUSTOMERS = [
  { name: "Marco", emoji: "🧔", lines: ["Rough day. Make me a {drink}, would you?", "A {drink} — and don't be shy with it."] },
  { name: "Lena", emoji: "👩", lines: ["Ooh, I'll have a {drink}, please!", "Feeling fancy tonight — a {drink} for me."] },
  { name: "Sofia", emoji: "👩‍🦰", lines: ["Could I get a {drink} when you have a sec?", "One {drink}, easy on the rush."] },
  { name: "James", emoji: "👨‍💼", lines: ["A {drink}, my good bartender.", "Long meeting. I've earned a {drink}."] },
  { name: "Priya", emoji: "👩‍🦱", lines: ["I've heard your {drink} is the best — prove it!", "Make it a {drink}, please."] },
  { name: "Tomás", emoji: "🧑", lines: ["Hit me with a {drink}.", "A {drink}, and keep 'em coming."] },
  { name: "Yuki", emoji: "🧑‍🎤", lines: ["A {drink} to celebrate!", "Let's do a {drink} tonight."] },
  { name: "Greta", emoji: "👵", lines: ["Back in my day we made a proper {drink}. Let's see yours.", "A {drink}, dear, when you're ready."] },
  { name: "Dmitri", emoji: "🕴️", lines: ["One {drink}. Make it count.", "A {drink}. I'm watching the technique."] },
  { name: "Nina", emoji: "💁‍♀️", lines: ["Surprise me— actually, a {drink}.", "A {drink} sounds perfect right now."] },
];

// ============================================================================
// Classic cocktails for the Mixologist "you (re)invented…" detector.
// Built from the campaign recipes plus a few extra well-known builds.
// Matching is by ingredient set + rough proportions, so amounts are reference.
// ============================================================================
// Extra builds not already covered by the 50-strong campaign list. The campaign
// now spans the canonical top-50, so all classics are sourced from RECIPES.
const EXTRA_CLASSICS = [];

export const CLASSICS = [
  ...RECIPES.map((r) => ({ name: r.name, glass: r.glass, method: r.method, ingredients: r.ingredients })),
  ...EXTRA_CLASSICS,
];

// Convenience lookups
export const INGREDIENT_BY_ID = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i]));
export const GLASS_BY_ID = Object.fromEntries(GLASSES.map((g) => [g.id, g]));
export const METHOD_BY_ID = Object.fromEntries(METHODS.map((m) => [m.id, m]));
export const GARNISH_BY_ID = Object.fromEntries(GARNISHES.map((g) => [g.id, g]));
export const TOOL_BY_ID = Object.fromEntries(TOOLS.map((t) => [t.id, t]));
