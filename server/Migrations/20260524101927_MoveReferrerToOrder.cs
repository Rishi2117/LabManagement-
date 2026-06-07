using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace server.Migrations
{
    /// <inheritdoc />
    public partial class MoveReferrerToOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReferredBy",
                table: "Patients");

            migrationBuilder.AddColumn<string>(
                name: "ReferredBy",
                table: "Orders",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReferredBy",
                table: "Orders");

            migrationBuilder.AddColumn<string>(
                name: "ReferredBy",
                table: "Patients",
                type: "text",
                nullable: true);
        }
    }
}
