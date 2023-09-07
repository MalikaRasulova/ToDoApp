using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ToDO.Migrations
{
    /// <inheritdoc />
    public partial class nevProjectBuild : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "ToDo");

            migrationBuilder.CreateTable(
                name: "users",
                schema: "ToDo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    phone_number = table.Column<string>(type: "text", nullable: false),
                    password = table.Column<string>(type: "text", nullable: false),
                    client_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "clients",
                schema: "ToDo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    phone_number = table.Column<string>(type: "text", nullable: false),
                    password = table.Column<string>(type: "text", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_clients", x => x.Id);
                    table.ForeignKey(
                        name: "FK_clients_users_user_id",
                        column: x => x.user_id,
                        principalSchema: "ToDo",
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "todos",
                schema: "ToDo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "text", nullable: true),
                    description = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_todos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_todos_clients_owner_id",
                        column: x => x.owner_id,
                        principalSchema: "ToDo",
                        principalTable: "clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_clients_Id",
                schema: "ToDo",
                table: "clients",
                column: "Id");

            migrationBuilder.CreateIndex(
                name: "IX_clients_user_id",
                schema: "ToDo",
                table: "clients",
                column: "user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_todos_Id",
                schema: "ToDo",
                table: "todos",
                column: "Id");

            migrationBuilder.CreateIndex(
                name: "IX_todos_owner_id",
                schema: "ToDo",
                table: "todos",
                column: "owner_id");

            migrationBuilder.CreateIndex(
                name: "IX_users_Id",
                schema: "ToDo",
                table: "users",
                column: "Id");

            migrationBuilder.CreateIndex(
                name: "IX_users_phone_number",
                schema: "ToDo",
                table: "users",
                column: "phone_number",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "todos",
                schema: "ToDo");

            migrationBuilder.DropTable(
                name: "clients",
                schema: "ToDo");

            migrationBuilder.DropTable(
                name: "users",
                schema: "ToDo");
        }
    }
}
