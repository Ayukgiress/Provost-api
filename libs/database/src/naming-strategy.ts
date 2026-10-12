import { DefaultNamingStrategy } from 'typeorm';

/**
 * Converts camelCase entity property names to snake_case database identifiers.
 *
 * Using a shared naming strategy keeps all column, table, and constraint names
 * consistent without having to specify `name` on every `@Column()`.
 *
 * Examples:
 *   createdAt  -> created_at
 *   userId     -> user_id
 *   educationLevel -> education_level
 */
export class SnakeNamingStrategy extends DefaultNamingStrategy {
  tableName(targetName: string, userSpecifiedName: string | undefined): string {
    return userSpecifiedName ?? this.toSnakeCase(targetName);
  }

  columnName(
    propertyName: string,
    customName: string | undefined,
    embeddedPrefixes: string[],
  ): string {
    const column = customName ?? this.toSnakeCase(propertyName);
    return [...embeddedPrefixes.map((p) => this.toSnakeCase(p)), column].join('_');
  }

  relationName(propertyName: string): string {
    return this.toSnakeCase(propertyName);
  }

  joinColumnName(relationName: string, referencedColumnName: string): string {
    return this.toSnakeCase(`${relationName}_${referencedColumnName}`);
  }

  joinTableName(
    firstTableName: string,
    secondTableName: string,
    firstPropertyName: string,
    _secondPropertyName: string,
  ): string {
    return this.toSnakeCase(
      `${firstTableName}_${firstPropertyName.replace(/\./gi, '_')}_${secondTableName}`,
    );
  }

  joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return this.toSnakeCase(`${tableName}_${columnName ?? propertyName}`);
  }

  classTableInheritanceParentColumnName(
    parentTableName: string,
    parentTableIdPropertyName: string,
  ): string {
    return this.toSnakeCase(`${parentTableName}_${parentTableIdPropertyName}`);
  }

  private toSnakeCase(input: string): string {
    return input
      .replace(/([A-Z])/g, '_$1')
      .replace(/^_/, '')
      .toLowerCase();
  }
}
