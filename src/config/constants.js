export default {
  response: {
    // Code 100 => Errores de usuario => Son los mismos que el main
    userNotFoundDelete: {
      data: {
        title: "Not found",
        message: "The user you're trying to delete, doesn't exixts",
        code: 113,
      },
      httpCode: 404,
    },
    userNotFoundGet: {
      data: {
        title: "Not found",
        message: "The user you're tryng to get doesn't exists",
        code: 106,
      },
      httpCode: 404,
    },
    userNotFoundUpdate: {
      data: {
        title: "Not found",
        message: "The user you're trying to update doesn't exists",
        code: 110,
      },
      httpCode: 404,
    },
    // Code: 5000 => Errores de segmentos
    userSegmentNotFound: {
      data: {
        title: "User not found",
        message: "The user who owned the segment was not found",
        code: 5000,
      },
      httpCode: 403,
    },
    segmentDeleteNotFound: {
      data: {
        title: "Segment not found",
        message: "The segment you are trying to delete does not exist or you do not have permission to delete it",
        code: 5001,
      },
      httpCode: 403,
    },
    segmentGetNotFound: {
      data: {
        title: "Segment not found",
        message: "The segment you are trying to retrieve does not exist or does not have permission to view it",
        code: 5002,
      },
      httpCode: 403,
    },
    segmentUpdateNotFound: {
      data: {
        title: "Segment not found",
        message: "The segment you are trying to update does not exist or does not have permission to view it",
        code: 5003,
      },
      httpCode: 403,
    },
    // Code: 5100 => Errores de columnas
    moduleHasNotColumns: {
      data: {
        title: "Columns not found",
        message: "The module you are trying to access does not have configured columns",
        code: 5100,
      },
      httpCode: 403,
    },
    // Code 5200 => Errores de perfiles
    profileDuplicated: {
      data: {
        title: "Profile duplicated",
        message: "The profile name is already in use",
        code: 5200,
      },
      httpCode: 409,
    },
    profileUpdateNotFound: {
      data: {
        title: "Profile not found",
        message: "The profile you are trying to update does not exist or does not have permission to view it",
        code: 5201,
      },
      httpCode: 403,
    },
    profileDeleteNotFound: {
      data: {
        title: "Profile not found",
        message: "The profile you are trying to delete does not exist or you do not have permission to delete it",
        code: 5002,
      },
      httpCode: 403,
    },
    profileGetNotFound: {
      data: {
        title: "Profile not found",
        message: "The profile you are trying to retrieve does not exist or does not have permission to view it",
        code: 5003,
      },
      httpCode: 403,
    },
    profileDeleteInUse: {
      data: {
        title: "Profile in use",
        message: "The profile you are trying to delete is assigned to one or more users",
        code: 5004,
      },
      httpCode: 401,
    },
    // Code 5300 => Errores de seguridad de usuario
    userSecurityDuplicated: {
      data: {
        title: "Duplicated",
        message: "The name is already in use",
        code: 5300,
      },
      httpCode: 409,
    },
    userSecurityUpdateNotFound: {
      data: {
        title: "Segurity not found",
        message: "The segurity you are trying to update does not exist or does not have permission to view it",
        code: 5301,
      },
      httpCode: 403,
    },
    userSecurityDeleteNotFound: {
      data: {
        title: "Security not found",
        message: "The security you are trying to delete does not exist or you do not have permission to delete it",
        code: 5302,
      },
      httpCode: 403,
    },
    userSecurityGetNotFound: {
      data: {
        title: "Security not found",
        message: "The security you are trying to retrieve does not exist or does not have permission to view it",
        code: 5303,
      },
      httpCode: 403,
    },
    userSecurityCantAccess: {
      data: {
        title: "No access",
        message: "You are not allowed to access at this time",
        code: 5304,
      },
      httpCode: 403,
    },
    userSecurityDeleteInUse: {
      data: {
        title: "Security profile in use",
        message: "The security profile you are trying to delete is assigned to one or more users",
        code: 5305,
      },
      httpCode: 401,
    },
    estateDuplicated: {
      data: {
        title: "Duplicate Estate",
        message: "The state tries to register is in use",
        code: 5306,
      },
      httpCode: 410,
    },
    delegationDuplicated: {
      data: {
        title: "Duplicate Delegation",
        message: "The delegation tries to register is in use",
        code: 5307,
      },
      httpCode: 411,
    },
    municipalityDuplicated: {
      data: {
        title: "Duplicate Municipality",
        message: "The municipality tries to register is in use",
        code: 5308,
      },
      httpCode: 412,
    },
    countryDuplicated: {
      data: {
        title: "Duplicate Country",
        message: "The country tries to register is in use",
        code: 5309,
      },
      httpCode: 413,
    },
    recordNotFound: {
      data: {
        title: "Not Found",
        message: "The record you want to delete is not found",
        code: 5310,
      },
      httpCode: 415,
    },
    recordDuplicated: {
      data: {
        title: "Catalogs",
        message: "Catalog in use",
        code: 5311,
      },
      httpCode: 421,
    },
    countryDeleteInUse: {
      data: {
        title: "Country in use",
        message: "The country you are trying to delete is assigned to one or more records",
        code: 5312,
      },
      httpCode: 422,
    },
    estateDeleteInUse: {
      data: {
        title: "Country in use",
        message: "The state you are trying to delete is assigned to one or more records",
        code: 5313,
      },
      httpCode: 423,
    },
    errorAddFileIcon: {
      data: {
        title: "Uploading error",
        message: "There was an error uploading the icon",
        code: 5314,
      },
      httpCode: 424,
    },
    errorAddIcon: {
      data: {
        title: "Error adding icons",
        message: "Error storing information",
        code: 5315,
      },
      httpCode: 425,
    },
    recordDuplicatedIconUnit: {
      data: {
        title: "Add Icons unit",
        message: "The description for the icon already exists",
        code: 5316,
      },
      httpCode: 426,
    },
    recordDuplicatedABank: {
      data: {
        title: "Catalogs",
        message: "Catalog in use",
        code: 5317,
      },
      httpCode: 427,
    },
    recordUsed: {
      data: {
        title: "Catalogs",
        message: "Record used by another module",
        code: 5318,
      },
      httpCode: 428,
    },
    lockedByUser: {
      data: {
        title: "Locked",
        message: "This item is locked by other user",
        code: 5318,
      },
      httpCode: 428,
    },
    unknownLock: {
      data: {
        title: "Unknown",
        message: "The item you are trying to update does not exist",
        code: 5319,
      },
      httpCode: 429,
    },
    forbiddenPatch: {
      data: {
        title: "Unknown",
        message: "The item you are trying to update does not exist",
        code: 5320,
      },
      httpCode: 430,
    },
    recordAdvancePaymentUsed: {
      data: {
        title: "Advance payments",
        message: "The advance that you want to register is already in the system.",
        code: 5319,
      },
      httpCode: 431,
    },
    canNotBeAssigned: {
      data: {
        title: "Assignment conflict",
        message: "This item can not be assigned at this time.",
        code: 5400,
      },
      httpCode: 432,
    },
    canNotBeAssigned2: {
      data: {
        code: 5402,
      },
      httpCode: 432,
    },
  },
  userSecurity: {
    restriction: {
      schedule: {
        id: 1,
        text: "Restricción por horario",
      },
      ip: {
        id: 2,
        text: "Restricción por IP",
      },
    },
  },
};
