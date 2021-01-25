exports.SUCCESS = (mes = "") => {
    return ({ status: "success", data: mes });
  };
  exports.ERROR = (mes = "") => {
    return ({ status: "error", data: mes });
  };