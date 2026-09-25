import type { EnvelopeRequestFn } from "../client.js";
import { ListPromise } from "../list.js";
import { toQuery } from "../query.js";
import type {
  MediaRecipe,
  MediaRecipeCreateInput,
  MediaRecipeListParams,
  MediaRecipeUpdateInput,
  RequestOptions,
  WriteOptions,
} from "../types.js";

export class MediaRecipesResource {
  constructor(private request: EnvelopeRequestFn) {}

  /**
   * List the workspace's media recipes.
   * Requires the `read:media_recipes` scope.
   *
   * @example
   * for await (const recipe of client.mediaRecipes.list({ status: "active" })) {
   *   console.log(recipe.title, recipe.components.length);
   * }
   */
  list(params: MediaRecipeListParams = {}, options?: RequestOptions): ListPromise<MediaRecipe> {
    return new ListPromise(
      (page) =>
        this.request<MediaRecipe[]>(
          `/api/v1/media-recipes${toQuery({
            status: params.status,
            limit: page.limit,
            offset: page.offset,
            cursor: page.cursor,
          })}`,
          {},
          options,
        ),
      params,
    );
  }

  /**
   * Get one media recipe with its components.
   * Requires the `read:media_recipes` scope.
   *
   * @example
   * const recipe = await client.mediaRecipes.get(recipeId);
   */
  async get(recipeId: string, options?: RequestOptions): Promise<MediaRecipe> {
    const { data } = await this.request<MediaRecipe>(
      `/api/v1/media-recipes/${encodeURIComponent(recipeId)}`,
      {},
      options,
    );
    return data;
  }

  /**
   * Create a media recipe.
   * Requires the `write:media_recipes` scope. Safe to retry with an
   * `Idempotency-Key`.
   *
   * @example
   * await client.mediaRecipes.create({
   *   title: "MS + 2 mg/L BAP",
   *   components: [
   *     { name: "MS basal salts", qty: "4.4", unit: "g/L" },
   *     { name: "Sucrose", qty: "30", unit: "g/L" },
   *     { name: "BAP", qty: "2", unit: "mg/L" },
   *   ],
   *   ph_target: 5.7,
   * });
   */
  async create(input: MediaRecipeCreateInput, options?: WriteOptions): Promise<MediaRecipe> {
    const { data } = await this.request<MediaRecipe>(
      "/api/v1/media-recipes",
      { method: "POST", body: JSON.stringify(input) },
      { ...options, idempotent: true },
    );
    return data;
  }

  /**
   * Update a media recipe. Only the fields you send change.
   * Requires the `write:media_recipes` scope.
   *
   * Only the recipe's author can edit it; a teammate's recipe answers
   * `403 MEDIA_RECIPE_NOT_OWNER`.
   *
   * @example
   * await client.mediaRecipes.update(recipeId, { status: "archived" });
   */
  async update(
    recipeId: string,
    input: MediaRecipeUpdateInput,
    options?: WriteOptions,
  ): Promise<MediaRecipe> {
    const { data } = await this.request<MediaRecipe>(
      `/api/v1/media-recipes/${encodeURIComponent(recipeId)}`,
      { method: "PATCH", body: JSON.stringify(input) },
      options,
    );
    return data;
  }
}
